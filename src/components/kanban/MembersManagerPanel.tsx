import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Users, Shield, Crown, UserCheck, Building2, RefreshCw, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg, type OrgRole } from '../../lib/org'
import { logger } from '../../lib/logger'

interface OrgMemberRow {
  id: string
  user_email: string
  role: OrgRole
  department_id: string | null
  created_at: string
}

interface MemberDisplay {
  id: string
  email: string
  name: string
  avatarColor: string
  role: OrgRole
  departmentName: string | null
  lastSeenAt: string | null
  createdAt: string
}

interface MembersManagerPanelProps {
  onClose: () => void
}

const ROLE_CONFIG: Record<OrgRole, { label: string; color: string; bg: string; icon: typeof Crown }> = {
  admin: { label: 'Admin', color: '#25D066', bg: 'rgba(37,208,102,0.12)', icon: Crown },
  supervisor: { label: 'Supervisor', color: '#579DFF', bg: 'rgba(87,157,255,0.12)', icon: Shield },
  agent: { label: 'Agente', color: '#9FADBC', bg: 'rgba(159,173,188,0.10)', icon: UserCheck },
}

const ROLE_ORDER: OrgRole[] = ['admin', 'supervisor', 'agent']

export default function MembersManagerPanel({ onClose }: MembersManagerPanelProps) {
  const { organizationId, hasPermission, departments } = useOrg()
  const [members, setMembers] = useState<MemberDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!organizationId) {
      setError('Organização não encontrada')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Buscar org_members
      const { data: orgMembers, error: omErr } = await supabase
        .from('org_members')
        .select('id, user_email, role, department_id, created_at')
        .eq('organization_id', organizationId)
        .order('role')

      if (omErr) {
        logger.warn('MembersPanel', 'Falha ao buscar org_members', { error: omErr.message })
        setError('Falha ao carregar membros')
        setLoading(false)
        return
      }

      const rows = (orgMembers ?? []) as OrgMemberRow[]

      // Buscar user_profiles para enriquecer com nome e avatar
      const emails = rows.map(r => r.user_email)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('email, name, avatar_color, last_seen_at')
        .in('email', emails)

      const profileMap = new Map(
        (profiles ?? []).map(p => [p.email.toLowerCase(), p])
      )

      // Mapear departamentos
      const deptMap = new Map(departments.map(d => [d.id, d.name]))

      const mapped: MemberDisplay[] = rows.map(row => {
        const profile = profileMap.get(row.user_email.toLowerCase())
        return {
          id: row.id,
          email: row.user_email,
          name: profile?.name ?? row.user_email.split('@')[0],
          avatarColor: profile?.avatar_color ?? '#579DFF',
          role: row.role,
          departmentName: row.department_id ? (deptMap.get(row.department_id) ?? null) : null,
          lastSeenAt: profile?.last_seen_at ?? null,
          createdAt: row.created_at,
        }
      })

      // Ordenar por role (admin > supervisor > agent) e depois por nome
      mapped.sort((a, b) => {
        const ra = ROLE_ORDER.indexOf(a.role)
        const rb = ROLE_ORDER.indexOf(b.role)
        if (ra !== rb) return ra - rb
        return a.name.localeCompare(b.name)
      })

      setMembers(mapped)
    } catch (err) {
      logger.error('MembersPanel', 'Exceção ao carregar membros', { error: String(err) })
      setError('Erro inesperado ao carregar membros')
    } finally {
      setLoading(false)
    }
  }, [organizationId, departments])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const formatLastSeen = (iso: string | null) => {
    if (!iso) return 'nunca'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'online agora'
    if (mins < 60) return `há ${mins}min`
    if (hrs < 24) return `há ${hrs}h`
    if (days === 1) return 'ontem'
    return `há ${days} dias`
  }

  // Agrupar por role
  const grouped = ROLE_ORDER.map(role => ({
    role,
    members: members.filter(m => m.role === role),
  })).filter(g => g.members.length > 0)

  const canManageMembers = hasPermission('members:invite')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: 340 }}
        animate={{ x: 0 }}
        exit={{ x: 340 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ width: 340, height: '100%', overflowY: 'auto', background: '#1d2125', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(37,208,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={16} style={{ color: '#25D066' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 900, color: '#E5E7EB', margin: 0, fontFamily: "'Paytone One', sans-serif" }}>Equipe</h2>
                <span style={{ fontSize: 11, color: '#596773', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {members.length} {members.length === 1 ? 'membro' : 'membros'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={fetchMembers}
                style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#596773', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
                title="Atualizar"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={onClose}
                style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#596773', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Resumo de roles */}
          {!loading && !error && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {ROLE_ORDER.map(role => {
                const count = members.filter(m => m.role === role).length
                if (count === 0) return null
                const cfg = ROLE_CONFIG[role]
                return (
                  <div
                    key={role}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 6,
                      background: cfg.bg, fontSize: 11, fontWeight: 600,
                      fontFamily: "'Space Grotesk', sans-serif", color: cfg.color,
                    }}
                  >
                    <cfg.icon size={12} />
                    {count} {cfg.label}{count > 1 ? 's' : ''}
                  </div>
                )
              })}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: '#596773', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
              <RefreshCw size={16} className="animate-spin" />
              Carregando membros...
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 12px', borderRadius: 8, background: 'rgba(239,92,72,0.08)', border: '1px solid rgba(239,92,72,0.2)', color: '#ef5c48', fontSize: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Lista agrupada por role */}
          {!loading && !error && grouped.map(group => {
            const cfg = ROLE_CONFIG[group.role]
            const RoleIcon = cfg.icon
            return (
              <div key={group.role} style={{ marginBottom: 12 }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <RoleIcon size={12} style={{ color: cfg.color }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: cfg.color, fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {cfg.label}s ({group.members.length})
                  </span>
                </div>

                {/* Members */}
                {group.members.map(member => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 4px', borderRadius: 6,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff',
                      background: member.avatarColor,
                    }}>
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 500, color: '#B6C2CF',
                          fontFamily: "'Space Grotesk', sans-serif",
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {member.name}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, color: '#596773',
                        fontFamily: "'Space Grotesk', sans-serif",
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        display: 'block',
                      }}>
                        {member.email}
                      </span>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        {member.departmentName && (
                          <span style={{ fontSize: 9, color: '#596773', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Building2 size={9} />
                            {member.departmentName}
                          </span>
                        )}
                        <span style={{ fontSize: 9, color: '#596773', fontFamily: "'Space Grotesk', sans-serif" }}>
                          {formatLastSeen(member.lastSeenAt)}
                        </span>
                      </div>
                    </div>

                    {/* Role badge */}
                    <div style={{
                      flexShrink: 0, padding: '2px 8px', borderRadius: 4,
                      fontSize: 9, fontWeight: 700,
                      fontFamily: "'Space Grotesk', sans-serif",
                      background: cfg.bg, color: cfg.color,
                      textTransform: 'uppercase', letterSpacing: '0.3px',
                    }}>
                      {cfg.label}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          {/* Vazio */}
          {!loading && !error && members.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#596773', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
              Nenhum membro encontrado.
            </div>
          )}

          {/* Info de permissão */}
          {!canManageMembers && !loading && (
            <div style={{
              marginTop: 8, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
              fontSize: 11, color: '#596773', fontFamily: "'Space Grotesk', sans-serif",
              textAlign: 'center',
            }}>
              Somente admins podem gerenciar membros
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
