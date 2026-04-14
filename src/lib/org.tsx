import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from './supabase'
import { logger } from './logger'
import { SUPER_ADMIN_EMAILS } from './superAdmins'

// ── Types ──

export type OrgRole = 'admin' | 'supervisor' | 'agent'

export interface OrgPermissions {
  organization_id: string
  department_id: string | null
  role: OrgRole
  organization_name: string
  organization_slug: string
  department_name: string | null
  department_slug: string | null
}

export interface OrgContextValue {
  /** Permissões do usuário logado (org, dept, role) */
  permissions: OrgPermissions | null
  /** Department ID ativo (o dept selecionado pelo usuário) */
  departmentId: string | null
  /** Organization ID do usuário */
  organizationId: string | null
  /** Role do usuário na org */
  role: OrgRole | null
  /** Carregando dados de permissão */
  loading: boolean
  /** Lista de departamentos visíveis */
  departments: { id: string; name: string; slug: string }[]
  /** Trocar departamento ativo (admin/supervisor podem trocar) */
  switchDepartment: (deptId: string) => void
  /** Verificar se o usuário tem uma permissão específica */
  hasPermission: (perm: string) => boolean
  /** Recarregar permissões */
  refresh: () => Promise<void>
}

const OrgContext = createContext<OrgContextValue | null>(null)

// ── Permissões por role (espelha role_permissions do banco) ──
const ROLE_PERMS: Record<OrgRole, Set<string>> = {
  admin: new Set([
    'tickets:create', 'tickets:read', 'tickets:update', 'tickets:delete', 'tickets:archive', 'tickets:assign',
    'columns:manage', 'labels:manage', 'members:invite', 'members:remove', 'members:change_role',
    'departments:manage', 'announcements:manage', 'links:manage', 'settings:manage',
  ]),
  supervisor: new Set([
    'tickets:create', 'tickets:read', 'tickets:update', 'tickets:delete', 'tickets:archive', 'tickets:assign',
    'columns:manage', 'labels:manage', 'announcements:manage', 'links:manage',
  ]),
  agent: new Set([
    'tickets:create', 'tickets:read', 'tickets:update', 'tickets:archive', 'links:manage',
  ]),
}

// ── Provider ──

export function OrgProvider({ user, children }: { user: string; children: ReactNode }) {
  const [permissions, setPermissions] = useState<OrgPermissions | null>(null)
  const [departments, setDepartments] = useState<{ id: string; name: string; slug: string }[]>([])
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    try {
      let resolved = false

      // Buscar permissões do usuário logado via view my_permissions
      try {
        const { data, error } = await supabase
          .from('my_permissions')
          .select('*')
          .limit(1)
          .maybeSingle()

        if (!error && data) {
          setPermissions(data as OrgPermissions)
          setActiveDeptId(data.department_id)
          resolved = true

          // Carregar departamentos visíveis
          if (data.organization_id) {
            const { data: depts } = await supabase
              .from('departments')
              .select('id, name, slug')
              .eq('organization_id', data.organization_id)
              .order('name')
            if (depts) setDepartments(depts)
          }
        }
      } catch {
        logger.warn('Org', 'Falha na view my_permissions, tentando fallback')
      }

      if (!resolved) {
        // Fallback: buscar via org_members diretamente
        try {
          const { data: member } = await supabase
            .from('org_members')
            .select('organization_id, department_id, role')
            .eq('user_email', user)
            .limit(1)
            .maybeSingle()

          if (member) {
            setPermissions({
              organization_id: member.organization_id,
              department_id: member.department_id,
              role: member.role as OrgRole,
              organization_name: '',
              organization_slug: '',
              department_name: null,
              department_slug: null,
            })
            
            const { data: depts } = await supabase
              .from('departments')
              .select('id, name, slug')
              .eq('organization_id', member.organization_id)
              .order('name')
            
            if (depts && depts.length > 0) {
              setDepartments(depts)
              // Se o membro for admin/supervisor geral (department_id = null), seta o primeiro departamento como ativo por padrão
              setActiveDeptId(member.department_id || depts[0].id)
            } else {
              setActiveDeptId(member.department_id)
            }
          }
        } catch {
          logger.warn('Org', 'Fallback org_members também falhou')
        }
      }

      // Fallback final: super admins sem registro em org_members
      // Carrega com role admin e tenta listar todos os departamentos
      if (!resolved && SUPER_ADMIN_EMAILS.includes(user.toLowerCase().trim())) {
        logger.warn('Org', 'Super admin sem org_members — aplicando fallback admin')

        // Tentar descobrir a org e departamentos disponíveis
        try {
          const { data: orgs } = await supabase
            .from('organizations')
            .select('id')
            .limit(1)
            .maybeSingle()

          const orgId = orgs?.id ?? null

          if (orgId) {
            const { data: depts } = await supabase
              .from('departments')
              .select('id, name, slug')
              .eq('organization_id', orgId)
              .order('name')
            if (depts && depts.length > 0) {
              setDepartments(depts)
              setActiveDeptId(depts[0].id)
            }
          }

          setPermissions({
            organization_id: orgId ?? '',
            department_id: null,
            role: 'admin',
            organization_name: '',
            organization_slug: '',
            department_name: null,
            department_slug: null,
          })
        } catch {
          // Mesmo se tudo falhar, garantir que super admin tem acesso
          setPermissions({
            organization_id: '',
            department_id: null,
            role: 'admin',
            organization_name: '',
            organization_slug: '',
            department_name: null,
            department_slug: null,
          })
        }
      }
    } catch (err) {
      logger.error('Org', 'Falha ao carregar permissões', { error: String(err) })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const switchDepartment = useCallback((deptId: string) => {
    setActiveDeptId(deptId)
  }, [])

  const hasPermission = useCallback((perm: string): boolean => {
    if (!permissions) return false
    return ROLE_PERMS[permissions.role]?.has(perm) ?? false
  }, [permissions])

  const value: OrgContextValue = {
    permissions,
    departmentId: activeDeptId,
    organizationId: permissions?.organization_id ?? null,
    role: permissions?.role ?? null,
    loading,
    departments,
    switchDepartment,
    hasPermission,
    refresh: loadPermissions,
  }

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg deve ser usado dentro de <OrgProvider>')
  return ctx
}
