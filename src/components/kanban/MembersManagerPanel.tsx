import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, Shield, Crown, UserCheck, Building2, RefreshCw, AlertCircle, ChevronDown, Check, KeyRound, Eye, EyeOff, Copy, CheckCircle2, UserMinus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg, type OrgRole } from '../../lib/org'
import { logger } from '../../lib/logger'

interface MemberDisplay {
  id: string
  email: string
  name: string
  avatarColor: string
  role: OrgRole
  departmentName: string | null
  lastSeenAt: string | null
  source: 'org_members' | 'user_profiles'
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
  const { organizationId, departmentId, hasPermission, departments, role: myRole } = useOrg()
  // Admins veem toda a org; supervisor/agent limitam ao dept ativo.
  const filterByDept: string | null = (myRole === 'admin') ? null : (departmentId ?? null)
  const [members, setMembers] = useState<MemberDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [resetPasswordEmail, setResetPasswordEmail] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removingMember, setRemovingMember] = useState(false)

  const canChangeRoles = myRole === 'admin' && hasPermission('members:change_role')

  // Email do usuário logado para impedir auto-remoção
  const [myEmail, setMyEmail] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setMyEmail(data.user.email.toLowerCase())
    })
  }, [])

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Buscar user_profiles primeiro (RLS permite SELECT para qualquer autenticado)
      const { data: profiles, error: profErr } = await supabase
        .from('user_profiles')
        .select('id, email, name, avatar_color, role, last_seen_at')
        .order('last_seen_at', { ascending: false })

      if (profErr) {
        logger.warn('MembersPanel', 'Falha ao buscar user_profiles', { error: profErr.message })
      }

      // Tentar enriquecer com org_members (roles reais do RBAC)
      const orgMembersMap = new Map<string, { role: OrgRole; departmentId: string | null }>()
      if (organizationId) {
        try {
          let omQuery = supabase
            .from('org_members')
            .select('user_email, role, department_id')
            .eq('organization_id', organizationId)
          if (filterByDept) omQuery = omQuery.eq('department_id', filterByDept)
          const { data: orgMembers, error: omErr } = await omQuery

          if (!omErr && orgMembers) {
            for (const om of orgMembers) {
              orgMembersMap.set(om.user_email.toLowerCase(), {
                role: om.role as OrgRole,
                departmentId: om.department_id,
              })
            }
          }
        } catch {
          logger.warn('MembersPanel', 'org_members indisponível')
        }
      }

      const deptMap = new Map(departments.map(d => [d.id, d.name]))
      const profileList = profiles ?? []

      if (profileList.length === 0 && orgMembersMap.size === 0) {
        setMembers([])
        setLoading(false)
        return
      }

      // Quando filtramos por dept, descartamos perfis sem org_member correspondente
      const filteredProfiles = filterByDept
        ? profileList.filter(p => orgMembersMap.has(p.email.toLowerCase()))
        : profileList

      const mapped: MemberDisplay[] = filteredProfiles.map(p => {
        const orgMember = orgMembersMap.get(p.email.toLowerCase())
        const resolvedRole = orgMember?.role ?? (p.role === 'admin' || p.role === 'supervisor' ? p.role as OrgRole : 'agent')
        const deptName = orgMember?.departmentId ? (deptMap.get(orgMember.departmentId) ?? null) : null

        return {
          id: p.id,
          email: p.email,
          name: p.name || p.email.split('@')[0],
          avatarColor: p.avatar_color || '#579DFF',
          role: resolvedRole,
          departmentName: deptName,
          lastSeenAt: p.last_seen_at,
          source: orgMember ? 'org_members' : 'user_profiles',
        }
      })

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
  }, [organizationId, departments, filterByDept])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleRoleChange = useCallback(async (memberEmail: string, newRole: OrgRole) => {
    setUpdatingRole(true)
    try {
      // Atualizar em org_members
      if (organizationId) {
        const { error: omErr } = await supabase
          .from('org_members')
          .update({ role: newRole })
          .eq('organization_id', organizationId)
          .eq('user_email', memberEmail)

        if (omErr) {
          logger.warn('MembersPanel', 'Falha ao atualizar role em org_members', { error: omErr.message })
        }
      }

      // Atualizar em user_profiles
      const { error: upErr } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('email', memberEmail)

      if (upErr) {
        logger.warn('MembersPanel', 'Falha ao atualizar role em user_profiles', { error: upErr.message })
      }

      // Atualizar estado local
      setMembers(prev => {
        const updated = prev.map(m =>
          m.email === memberEmail ? { ...m, role: newRole } : m
        )
        updated.sort((a, b) => {
          const ra = ROLE_ORDER.indexOf(a.role)
          const rb = ROLE_ORDER.indexOf(b.role)
          if (ra !== rb) return ra - rb
          return a.name.localeCompare(b.name)
        })
        return updated
      })
      setChangingRole(null)
    } catch (err) {
      logger.error('MembersPanel', 'Exceção ao alterar role', { error: String(err) })
    } finally {
      setUpdatingRole(false)
    }
  }, [organizationId])

  const handleRemoveMember = useCallback(async (memberEmail: string) => {
    setRemovingMember(true)
    try {
      // Remover de org_members
      if (organizationId) {
        const { error: omErr } = await supabase
          .from('org_members')
          .delete()
          .eq('organization_id', organizationId)
          .eq('user_email', memberEmail)
        if (omErr) logger.warn('MembersPanel', 'Falha ao remover de org_members', { error: omErr.message })
      }

      // Remover de user_profiles
      const { error: upErr } = await supabase
        .from('user_profiles')
        .delete()
        .eq('email', memberEmail)
      if (upErr) logger.warn('MembersPanel', 'Falha ao remover de user_profiles', { error: upErr.message })

      // Atualizar estado local
      setMembers(prev => prev.filter(m => m.email !== memberEmail))
      setConfirmRemove(null)
    } catch (err) {
      logger.error('MembersPanel', 'Exceção ao remover membro', { error: String(err) })
    } finally {
      setRemovingMember(false)
    }
  }, [organizationId])

  const handleResetPassword = useCallback(async (email: string) => {
    if (!newPassword.trim()) return
    if (!currentPassword.trim()) {
      logger.warn('MembersPanel', 'Senha atual não informada')
      return
    }
    // Validar senha: 8+ chars, 1 maiúscula, 1 especial
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword)) {
      logger.warn('MembersPanel', 'Senha não atende requisitos')
      return
    }
    setResettingPassword(true)
    try {
      // Verificar identidade do admin re-autenticando com senha atual
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser?.email) {
        logger.error('MembersPanel', 'Usuário admin não encontrado')
        setResettingPassword(false)
        return
      }
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword.trim(),
      })
      if (authError) {
        logger.error('MembersPanel', 'Senha atual incorreta', { error: authError.message })
        setResettingPassword(false)
        return
      }

      // Usar Supabase Admin API via Edge Function ou enviar e-mail de reset
      // Como não temos acesso ao service_role no frontend, vamos usar o método nativo
      const { error } = await supabase.functions.invoke('admin-reset-password', {
        body: { email, newPassword: newPassword.trim() },
      })
      if (error) {
        logger.error('MembersPanel', 'Falha ao redefinir senha via Edge Function', { error: String(error) })
        // Fallback: enviar e-mail de redefinição
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (resetErr) {
          logger.error('MembersPanel', 'Falha ao enviar e-mail de redefinição', { error: resetErr.message })
        } else {
          setResetSuccess(email)
          setTimeout(() => setResetSuccess(null), 4000)
        }
      } else {
        setResetSuccess(email)
        setTimeout(() => setResetSuccess(null), 4000)
      }
    } catch {
      // Fallback: enviar e-mail de redefinição
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (resetErr) {
        logger.error('MembersPanel', 'Falha ao enviar e-mail de redefinição (fallback)', { error: resetErr.message })
      } else {
        setResetSuccess(email)
        setTimeout(() => setResetSuccess(null), 4000)
      }
    } finally {
      setResettingPassword(false)
      setNewPassword('')
      setCurrentPassword('')
      setResetPasswordEmail(null)
      setShowNewPassword(false)
      setShowCurrentPassword(false)
    }
  }, [newPassword, currentPassword])

  function generateTempPassword(): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const digits = '0123456789'
    const special = '!@#$%&*'
    const all = upper + lower + digits + special
    let pw = ''
    pw += upper[Math.floor(Math.random() * upper.length)]
    pw += special[Math.floor(Math.random() * special.length)]
    pw += digits[Math.floor(Math.random() * digits.length)]
    for (let i = 0; i < 5; i++) pw += all[Math.floor(Math.random() * all.length)]
    // Shuffle
    return pw.split('').sort(() => Math.random() - 0.5).join('')
  }

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text) } catch { /* no-op */ }
  }

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

  const isOnline = (iso: string | null) => {
    if (!iso) return false
    return (Date.now() - new Date(iso).getTime()) < 300000 // 5 min
  }

  const grouped = ROLE_ORDER.map(role => ({
    role,
    members: members.filter(m => m.role === role),
  })).filter(g => g.members.length > 0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => {
        if (e.target === e.currentTarget) {
          if (changingRole) { setChangingRole(null); return }
          onClose()
        }
      }}
    >
      <motion.div
        initial={{ x: 360 }}
        animate={{ x: 0 }}
        exit={{ x: 360 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          width: 360, height: '100%', overflowY: 'auto',
          background: '#1d2125', borderLeft: '1px solid rgba(37,208,102,0.08)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 20px 20px',
          background: 'linear-gradient(180deg, rgba(37,208,102,0.06) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'linear-gradient(135deg, #25D066 0%, #1BAD53 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37,208,102,0.2)',
              }}>
                <Users size={18} style={{ color: '#fff' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 900, color: '#fff', margin: 0, fontFamily: "'Paytone One', sans-serif", letterSpacing: '-0.01em' }}>
                  Equipe
                </h2>
                <span style={{ fontSize: 12, color: '#6B7685', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {members.length} {members.length === 1 ? 'membro' : 'membros'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={fetchMembers}
                style={{
                  width: 32, height: 32, borderRadius: 10, border: 'none',
                  background: 'rgba(255,255,255,0.04)', color: '#6B7685', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.1)'; e.currentTarget.style.color = '#25D066' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#6B7685' }}
                title="Atualizar"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: 10, border: 'none',
                  background: 'rgba(255,255,255,0.04)', color: '#6B7685', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#6B7685' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Contadores rápidos */}
          {!loading && !error && members.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {ROLE_ORDER.map(role => {
                const count = members.filter(m => m.role === role).length
                if (count === 0) return null
                const cfg = ROLE_CONFIG[role]
                const Icon = cfg.icon
                return (
                  <div
                    key={role}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 0', borderRadius: 10,
                      background: '#22272B', border: '1px solid rgba(255,255,255,0.04)',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    <Icon size={13} style={{ color: cfg.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#E5E7EB' }}>{count}</span>
                    <span style={{ fontSize: 11, color: '#6B7685' }}>{cfg.label}{count > 1 ? 's' : ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, padding: '12px 16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12, color: '#6B7685' }}>
              <RefreshCw size={20} className="animate-spin" style={{ color: '#25D066' }} />
              <span style={{ fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>Carregando equipe...</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
              color: '#f87171', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Lista de membros */}
          {!loading && !error && grouped.map(group => {
            const cfg = ROLE_CONFIG[group.role]
            const RoleIcon = cfg.icon
            return (
              <div key={group.role} style={{ marginBottom: 8 }}>
                {/* Separador de seção */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 4px 8px',
                }}>
                  <RoleIcon size={13} style={{ color: cfg.color }} />
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
                    color: cfg.color, fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {cfg.label}s
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: '#4B5563',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    ({group.members.length})
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
                </div>

                {/* Cards dos membros */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {group.members.map(member => {
                    const memberCfg = ROLE_CONFIG[member.role]
                    const online = isOnline(member.lastSeenAt)
                    return (
                      <div
                        key={member.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px', borderRadius: 12,
                          background: '#22272B',
                          border: '1px solid rgba(255,255,255,0.03)',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#282E33'
                          e.currentTarget.style.borderColor = 'rgba(37,208,102,0.1)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#22272B'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)'
                        }}
                      >
                        {/* Avatar com indicador online */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700, color: '#fff',
                            background: member.avatarColor,
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}>
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          {/* Status dot */}
                          <div style={{
                            position: 'absolute', bottom: -1, right: -1,
                            width: 12, height: 12, borderRadius: '50%',
                            background: online ? '#25D066' : '#4B5563',
                            border: '2px solid #22272B',
                            transition: 'background 0.3s',
                          }} />
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 14, fontWeight: 600, color: '#E5E7EB',
                              fontFamily: "'Space Grotesk', sans-serif",
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {member.name}
                            </span>
                            {online && (
                              <span style={{
                                fontSize: 9, fontWeight: 600, color: '#25D066',
                                fontFamily: "'Space Grotesk', sans-serif",
                                background: 'rgba(37,208,102,0.1)', padding: '1px 6px', borderRadius: 4,
                              }}>
                                online
                              </span>
                            )}
                          </div>
                          <span style={{
                            fontSize: 11, color: '#596773',
                            fontFamily: "'Space Grotesk', sans-serif",
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            display: 'block', marginTop: 1,
                          }}>
                            {member.email}
                          </span>
                          {member.departmentName && (
                            <span style={{
                              fontSize: 10, color: '#4B5563', fontFamily: "'Space Grotesk', sans-serif",
                              display: 'flex', alignItems: 'center', gap: 3, marginTop: 2,
                            }}>
                              <Building2 size={9} />
                              {member.departmentName}
                            </span>
                          )}
                          {!online && member.lastSeenAt && (
                            <span style={{
                              fontSize: 10, color: '#4B5563', fontFamily: "'Space Grotesk', sans-serif",
                              marginTop: 2, display: 'block',
                            }}>
                              Visto {formatLastSeen(member.lastSeenAt)}
                            </span>
                          )}
                        </div>

                        {/* Ações */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {/* Botão remover membro (admin only, não pode remover a si mesmo) */}
                          {canChangeRoles && myEmail && member.email.toLowerCase() !== myEmail && (
                            <button
                              onClick={() => setConfirmRemove(member.email)}
                              style={{
                                width: 30, height: 30, borderRadius: 8, border: 'none',
                                background: 'transparent',
                                color: '#596773',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#f87171' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
                              title="Remover membro"
                            >
                              <UserMinus size={14} />
                            </button>
                          )}

                          {/* Botão reset senha (admin only) */}
                          {canChangeRoles && (
                            <button
                              onClick={() => { setResetPasswordEmail(member.email); setNewPassword(''); setCurrentPassword(''); setShowNewPassword(false); setShowCurrentPassword(false) }}
                              style={{
                                width: 30, height: 30, borderRadius: 8, border: 'none',
                                background: resetSuccess === member.email ? 'rgba(37,208,102,0.12)' : 'transparent',
                                color: resetSuccess === member.email ? '#25D066' : '#596773',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { if (resetSuccess !== member.email) { e.currentTarget.style.background = 'rgba(37,208,102,0.08)'; e.currentTarget.style.color = '#25D066' } }}
                              onMouseLeave={e => { if (resetSuccess !== member.email) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' } }}
                              title={resetSuccess === member.email ? 'Senha redefinida!' : 'Redefinir senha'}
                            >
                              {resetSuccess === member.email ? <CheckCircle2 size={14} /> : <KeyRound size={14} />}
                            </button>
                          )}

                          {/* Seletor de role */}
                          {canChangeRoles ? (
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <button
                                onClick={() => setChangingRole(changingRole === member.email ? null : member.email)}
                                disabled={updatingRole}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '5px 10px', borderRadius: 8,
                                  fontSize: 11, fontWeight: 700,
                                  fontFamily: "'Space Grotesk', sans-serif",
                                  background: memberCfg.bg, color: memberCfg.color,
                                  border: `1px solid ${memberCfg.color}20`,
                                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.3px',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${memberCfg.color}60` }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = `${memberCfg.color}20` }}
                              >
                                {memberCfg.label}
                                <ChevronDown size={11} />
                              </button>

                              <AnimatePresence>
                                {changingRole === member.email && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                    transition={{ duration: 0.12 }}
                                    style={{
                                      position: 'absolute', right: 0, top: '100%', marginTop: 6,
                                      minWidth: 150, borderRadius: 12, overflow: 'hidden', zIndex: 10,
                                      background: '#282E33', border: '1px solid rgba(255,255,255,0.08)',
                                      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                                    }}
                                  >
                                    <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Space Grotesk', sans-serif" }}>
                                        Alterar função
                                      </span>
                                    </div>
                                    {ROLE_ORDER.map(r => {
                                      const rc = ROLE_CONFIG[r]
                                      const RIcon = rc.icon
                                      const isActive = member.role === r
                                      return (
                                        <button
                                          key={r}
                                          onClick={() => !isActive && handleRoleChange(member.email, r)}
                                          disabled={isActive || updatingRole}
                                          style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '9px 12px', border: 'none',
                                            background: isActive ? 'rgba(37,208,102,0.06)' : 'transparent',
                                            color: isActive ? rc.color : '#9FADBC',
                                            cursor: isActive ? 'default' : 'pointer',
                                            fontSize: 13, fontWeight: isActive ? 600 : 400,
                                            fontFamily: "'Space Grotesk', sans-serif",
                                            transition: 'background 0.1s',
                                          }}
                                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                                        >
                                          <RIcon size={14} style={{ color: rc.color, flexShrink: 0 }} />
                                          <span style={{ flex: 1, textAlign: 'left' }}>{rc.label}</span>
                                          {isActive && <Check size={14} style={{ color: '#25D066', flexShrink: 0 }} />}
                                        </button>
                                      )
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ) : (
                            <div style={{
                              flexShrink: 0, padding: '4px 10px', borderRadius: 8,
                              fontSize: 10, fontWeight: 700,
                              fontFamily: "'Space Grotesk', sans-serif",
                              background: memberCfg.bg, color: memberCfg.color,
                              textTransform: 'uppercase', letterSpacing: '0.3px',
                            }}>
                              {memberCfg.label}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Modal de redefinir senha */}
          <AnimatePresence>
            {resetPasswordEmail && canChangeRoles && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 60,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                }}
                onClick={e => { if (e.target === e.currentTarget) { setResetPasswordEmail(null); setNewPassword(''); setCurrentPassword(''); setShowNewPassword(false); setShowCurrentPassword(false) } }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 10 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    width: '100%', maxWidth: 400, borderRadius: 20, padding: '28px',
                    background: '#22272B', border: '1px solid rgba(37,208,102,0.08)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
                  }}
                >
                  {/* Header do modal */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: 'linear-gradient(135deg, #25D066 0%, #1BAD53 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(37,208,102,0.2)',
                    }}>
                      <KeyRound size={20} style={{ color: '#fff' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#E5E7EB', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                        Redefinir senha
                      </h3>
                      <p style={{ fontSize: 12, color: '#596773', margin: '2px 0 0', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {resetPasswordEmail}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Senha atual */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7685', fontFamily: "'Space Grotesk', sans-serif", display: 'block', marginBottom: 6 }}>
                        Sua senha atual
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          placeholder="Confirme sua identidade"
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          style={{
                            width: '100%', padding: '12px 44px 12px 14px', borderRadius: 12, fontSize: 14,
                            fontFamily: "'Space Grotesk', sans-serif", color: '#E5E7EB', background: '#1d2125',
                            border: '1px solid rgba(255,255,255,0.06)', outline: 'none', boxSizing: 'border-box',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                          }}
                          onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
                        />
                        <button type="button" onClick={() => setShowCurrentPassword(p => !p)}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                          {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Divisor */}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '2px 0' }} />

                    {/* Nova senha */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7685', fontFamily: "'Space Grotesk', sans-serif", display: 'block', marginBottom: 6 }}>
                        Nova senha do membro
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="Criar nova senha"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          style={{
                            width: '100%', padding: '12px 80px 12px 14px', borderRadius: 12, fontSize: 14,
                            fontFamily: "'Space Grotesk', sans-serif", color: '#E5E7EB', background: '#1d2125',
                            border: '1px solid rgba(255,255,255,0.06)', outline: 'none', boxSizing: 'border-box',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                          }}
                          onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
                        />
                        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 2 }}>
                          <button type="button" onClick={() => setShowNewPassword(p => !p)}
                            style={{ background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                            {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          {newPassword && (
                            <button type="button" onClick={() => copyToClipboard(newPassword)} title="Copiar senha"
                              style={{ background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                              <Copy size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Gerar senha */}
                    <button
                      type="button"
                      onClick={() => { const pw = generateTempPassword(); setNewPassword(pw); setShowNewPassword(true) }}
                      style={{
                        background: 'rgba(37,208,102,0.06)', border: '1px solid rgba(37,208,102,0.12)',
                        borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 600,
                        fontFamily: "'Space Grotesk', sans-serif", color: '#25D066', cursor: 'pointer',
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.1)'; e.currentTarget.style.borderColor = 'rgba(37,208,102,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.06)'; e.currentTarget.style.borderColor = 'rgba(37,208,102,0.12)' }}
                    >
                      Gerar senha segura
                    </button>

                    {/* Validação */}
                    {newPassword.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}>
                        {[
                          { label: 'Mínimo 8 caracteres', valid: newPassword.length >= 8 },
                          { label: 'Uma letra maiúscula', valid: /[A-Z]/.test(newPassword) },
                          { label: 'Um caractere especial', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword) },
                        ].map((check, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            {check.valid ? (
                              <CheckCircle2 size={13} style={{ color: '#25D066', flexShrink: 0 }} />
                            ) : (
                              <X size={13} style={{ color: '#4B5563', flexShrink: 0 }} />
                            )}
                            <span style={{
                              fontSize: 12, fontFamily: "'Space Grotesk', sans-serif",
                              color: check.valid ? '#25D066' : '#596773',
                            }}>
                              {check.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Botões */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                      <button
                        onClick={() => { setResetPasswordEmail(null); setNewPassword(''); setCurrentPassword(''); setShowNewPassword(false); setShowCurrentPassword(false) }}
                        style={{
                          flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                          fontFamily: "'Space Grotesk', sans-serif", cursor: 'pointer',
                          background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                          color: '#9FADBC', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleResetPassword(resetPasswordEmail)}
                        disabled={resettingPassword || !currentPassword.trim() || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword)}
                        style={{
                          flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
                          fontFamily: "'Space Grotesk', sans-serif", cursor: resettingPassword ? 'not-allowed' : 'pointer',
                          background: '#25D066', border: 'none', color: '#fff',
                          opacity: (resettingPassword || !currentPassword.trim() || newPassword.length < 8) ? 0.4 : 1,
                          transition: 'all 0.15s',
                          boxShadow: '0 4px 12px rgba(37,208,102,0.2)',
                        }}
                        onMouseEnter={e => { if (!resettingPassword) e.currentTarget.style.background = '#1BAD53' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#25D066' }}
                      >
                        {resettingPassword ? 'Redefinindo...' : 'Redefinir senha'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal de confirmação de remoção */}
          <AnimatePresence>
            {confirmRemove && canChangeRoles && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 60,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                }}
                onClick={e => { if (e.target === e.currentTarget) setConfirmRemove(null) }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 10 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    width: '100%', maxWidth: 380, borderRadius: 20, padding: '28px',
                    background: '#22272B', border: '1px solid rgba(239,68,68,0.15)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(239,68,68,0.2)',
                    }}>
                      <UserMinus size={20} style={{ color: '#fff' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#E5E7EB', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                        Remover membro
                      </h3>
                      <p style={{ fontSize: 12, color: '#596773', margin: '2px 0 0', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {confirmRemove}
                      </p>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: '#9FADBC', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.5, margin: '0 0 20px' }}>
                    Tem certeza que deseja remover este membro? Ele perderá acesso à plataforma e precisará ser adicionado novamente.
                  </p>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      style={{
                        padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        fontFamily: "'Space Grotesk', sans-serif",
                        background: 'rgba(255,255,255,0.04)', color: '#9FADBC', border: '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleRemoveMember(confirmRemove)}
                      disabled={removingMember}
                      style={{
                        padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        fontFamily: "'Space Grotesk', sans-serif",
                        background: '#ef4444', color: '#fff', border: 'none',
                        cursor: removingMember ? 'not-allowed' : 'pointer',
                        opacity: removingMember ? 0.6 : 1, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!removingMember) e.currentTarget.style.background = '#dc2626' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#ef4444' }}
                    >
                      {removingMember ? 'Removendo...' : 'Remover'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vazio */}
          {!loading && !error && members.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Users size={32} style={{ color: '#4B5563', marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#6B7685', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>
                Nenhum membro encontrado
              </p>
            </div>
          )}

          {/* Info de permissão (não-admin) */}
          {!canChangeRoles && !loading && members.length > 0 && (
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(37,208,102,0.04)', border: '1px solid rgba(37,208,102,0.08)',
              fontSize: 12, color: '#6B7685', fontFamily: "'Space Grotesk', sans-serif",
              textAlign: 'center',
            }}>
              Somente admins podem alterar funções
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
