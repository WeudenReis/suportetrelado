import { createContext, useContext } from 'react'

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
  permissions: OrgPermissions | null
  departmentId: string | null
  organizationId: string | null
  role: OrgRole | null
  loading: boolean
  departments: { id: string; name: string; slug: string }[]
  switchDepartment: (deptId: string) => void
  hasPermission: (perm: string) => boolean
  refresh: () => Promise<void>
}

export const OrgContext = createContext<OrgContextValue | null>(null)

const ROLE_PRIORITY: Record<string, number> = { admin: 3, supervisor: 2, agent: 1 }

export function bestRoleFrom(rows: { role: string }[], fallback: OrgRole = 'agent'): OrgRole {
  if (!rows.length) return fallback
  return rows.reduce<OrgRole>((best, r) => {
    const rp = ROLE_PRIORITY[r.role] ?? 0
    return rp > (ROLE_PRIORITY[best] ?? 0) ? (r.role as OrgRole) : best
  }, fallback)
}

export const ROLE_PERMS: Record<OrgRole, Set<string>> = {
  admin: new Set([
    'tickets:create', 'tickets:read', 'tickets:update', 'tickets:assign',
    'tickets:edit_details', 'tickets:archive', 'tickets:delete',
    'columns:manage', 'labels:manage', 'announcements:manage', 'links:manage',
    'members:invite', 'members:remove', 'members:change_role',
    'departments:manage', 'settings:manage',
  ]),
  supervisor: new Set([
    'tickets:create', 'tickets:read', 'tickets:update', 'tickets:assign',
    'tickets:edit_details', 'tickets:archive',
    'columns:manage', 'labels:manage', 'announcements:manage', 'links:manage',
    'settings:manage',
  ]),
  agent: new Set([
    'tickets:create', 'tickets:read', 'tickets:update', 'tickets:archive',
    'links:manage',
  ]),
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg deve ser usado dentro de <OrgProvider>')
  return ctx
}
