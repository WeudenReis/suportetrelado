import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Pencil, Check, KeyRound, Eye, EyeOff, CheckCircle2, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { logger } from '../../lib/logger'

interface ProfileData {
  name: string
  email: string
  avatarColor: string
}

const PASSWORD_CHECKS = [
  { label: 'Mínimo 8 caracteres',              test: (p: string) => p.length >= 8 },
  { label: 'Uma letra maiúscula',               test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Um caractere especial (!@#$...)',   test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p) },
]

export default function MyProfilePanel({ onClose }: { onClose: () => void }) {
  const [profile, setProfile]         = useState<ProfileData | null>(null)
  const [loadingProfile, setLoading]  = useState(true)

  // Edição de nome
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue]     = useState('')
  const [savingName, setSavingName]   = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // Alteração de senha
  const [showPwSection, setShowPwSection] = useState(false)
  const [newPassword, setNewPassword]     = useState('')
  const [showPassword, setShowPassword]   = useState(false)
  const [savingPw, setSavingPw]           = useState(false)
  const [pwSuccess, setPwSuccess]         = useState(false)
  const [pwError, setPwError]             = useState<string | null>(null)

  const pwChecks = PASSWORD_CHECKS.map(c => ({ ...c, valid: c.test(newPassword) }))
  const pwValid  = pwChecks.every(c => c.valid)

  // ── Carregar perfil ──
  useEffect(() => {
    async function load() {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const email = authData?.user?.email ?? ''

        const { data: prof } = await supabase
          .from('user_profiles')
          .select('name, email, avatar_color')
          .eq('email', email)
          .maybeSingle()

        setProfile({
          name:        prof?.name || email.split('@')[0],
          email:       prof?.email || email,
          avatarColor: prof?.avatar_color || '#579DFF',
        })
        setNameValue(prof?.name || email.split('@')[0])
      } catch (err) {
        logger.error('MyProfilePanel', 'Falha ao carregar perfil', { error: String(err) })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Salvar nome ──
  const handleSaveName = useCallback(async () => {
    if (!profile) return
    const trimmed = nameValue.trim()
    if (!trimmed) { setEditingName(false); return }
    setSavingName(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ name: trimmed })
        .eq('email', profile.email)
      if (error) { logger.error('MyProfilePanel', 'Falha ao salvar nome', { error: error.message }); return }
      setProfile(prev => prev ? { ...prev, name: trimmed } : prev)
      setEditingName(false)
    } catch (err) {
      logger.error('MyProfilePanel', 'Exceção ao salvar nome', { error: String(err) })
    } finally {
      setSavingName(false)
    }
  }, [profile, nameValue])

  // ── Alterar senha ──
  const handleSavePassword = useCallback(async () => {
    if (!pwValid) return
    setSavingPw(true)
    setPwError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPwError('Falha ao alterar senha. Tente novamente.')
        logger.error('MyProfilePanel', 'Falha ao alterar senha', { error: error.message })
        return
      }
      setPwSuccess(true)
      setNewPassword('')
      setShowPassword(false)
      setTimeout(() => { setPwSuccess(false); setShowPwSection(false) }, 3000)
    } catch (err) {
      setPwError('Erro inesperado. Verifique sua conexão.')
      logger.error('MyProfilePanel', 'Exceção ao alterar senha', { error: String(err) })
    } finally {
      setSavingPw(false)
    }
  }, [pwValid, newPassword])

  const initials = profile?.name.slice(0, 2).toUpperCase() ?? '??'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ x: 360 }}
        animate={{ x: 0 }}
        exit={{ x: 360 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          width: 340, height: '100%', overflowY: 'auto',
          background: '#1d2125', borderLeft: '1px solid rgba(37,208,102,0.08)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 20px 20px',
          background: 'linear-gradient(180deg, rgba(37,208,102,0.06) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'linear-gradient(135deg, #25D066 0%, #1BAD53 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37,208,102,0.2)',
            }}>
              <User size={18} style={{ color: '#fff' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: 17, fontWeight: 900, color: '#fff', margin: 0,
                fontFamily: "'Paytone One', sans-serif", letterSpacing: '-0.01em',
              }}>
                Meu Perfil
              </h2>
              <span style={{ fontSize: 12, color: '#6B7685', fontFamily: "'Space Grotesk', sans-serif" }}>
                Suas informações pessoais
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.04)', color: '#6B7685',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#6B7685' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {loadingProfile ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0', color: '#6B7685' }}>
              <span style={{ fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>Carregando...</span>
            </div>
          ) : profile && (
            <>
              {/* Card de identidade */}
              <div style={{
                background: '#22272B', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.04)',
                padding: '20px 18px',
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                    background: profile.avatarColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: '#fff',
                    fontFamily: "'Space Grotesk', sans-serif",
                    boxShadow: `0 4px 16px ${profile.avatarColor}40`,
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#596773', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Nome exibido
                    </span>
                    {/* Nome — modo edição ou exibição */}
                    {editingName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <input
                          ref={nameRef}
                          autoFocus
                          value={nameValue}
                          onChange={e => setNameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveName()
                            if (e.key === 'Escape') { setEditingName(false); setNameValue(profile.name) }
                          }}
                          disabled={savingName}
                          style={{
                            flex: 1, minWidth: 0,
                            padding: '4px 10px', borderRadius: 8, fontSize: 14,
                            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                            color: '#E5E7EB', background: 'rgba(255,255,255,0.05)',
                            border: '1px solid #25D066', outline: 'none',
                            boxShadow: '0 0 0 2px rgba(37,208,102,0.15)',
                          }}
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={savingName}
                          title="Confirmar"
                          style={{
                            width: 26, height: 26, borderRadius: 7, border: 'none',
                            background: 'rgba(37,208,102,0.18)', color: '#25D066',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.32)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.18)' }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => { setEditingName(false); setNameValue(profile.name) }}
                          title="Cancelar"
                          style={{
                            width: 26, height: 26, borderRadius: 7, border: 'none',
                            background: 'rgba(255,255,255,0.05)', color: '#596773',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#596773' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{
                          fontSize: 15, fontWeight: 700, color: '#E5E7EB',
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}>
                          {profile.name}
                        </span>
                        <button
                          onClick={() => { setNameValue(profile.name); setEditingName(true) }}
                          title="Editar nome"
                          style={{
                            width: 20, height: 20, borderRadius: 5, border: 'none',
                            background: 'transparent', color: '#4B5563',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0, transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#25D066' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#4B5563' }}
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divisor */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                {/* E-mail */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#596773', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    E-mail
                  </span>
                  <p style={{
                    fontSize: 13, color: '#9FADBC', margin: '4px 0 0',
                    fontFamily: "'Space Grotesk', sans-serif",
                    wordBreak: 'break-all',
                  }}>
                    {profile.email}
                  </p>
                </div>
              </div>

              {/* Seção alterar senha */}
              <div style={{
                background: '#22272B', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.04)',
                overflow: 'hidden',
              }}>
                {/* Cabeçalho clicável */}
                <button
                  onClick={() => { setShowPwSection(p => !p); setPwError(null); setNewPassword(''); setShowPassword(false) }}
                  style={{
                    width: '100%', padding: '16px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {pwSuccess
                      ? <CheckCircle2 size={16} style={{ color: '#25D066' }} />
                      : <KeyRound size={16} style={{ color: '#579DFF' }} />
                    }
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: pwSuccess ? '#25D066' : '#E5E7EB',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}>
                      {pwSuccess ? 'Senha alterada!' : 'Alterar senha'}
                    </span>
                  </div>
                  <motion.span
                    animate={{ rotate: showPwSection ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ color: '#6B7685', fontSize: 16, lineHeight: 1, display: 'flex' }}
                  >
                    ▾
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {showPwSection && !pwSuccess && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                        {/* Campo nova senha */}
                        <div>
                          <label style={{
                            fontSize: 11, fontWeight: 600, color: '#6B7685',
                            fontFamily: "'Space Grotesk', sans-serif", display: 'block', marginBottom: 6,
                          }}>
                            Nova senha
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Digite a nova senha"
                              value={newPassword}
                              onChange={e => { setNewPassword(e.target.value); setPwError(null) }}
                              onKeyDown={e => { if (e.key === 'Enter') handleSavePassword() }}
                              disabled={savingPw}
                              style={{
                                width: '100%', padding: '11px 40px 11px 13px', borderRadius: 10,
                                fontSize: 14, fontFamily: "'Space Grotesk', sans-serif",
                                color: '#E5E7EB', background: '#1d2125',
                                border: '1px solid rgba(255,255,255,0.06)', outline: 'none',
                                boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
                              }}
                              onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(p => !p)}
                              style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: '#596773', cursor: 'pointer',
                                padding: 4, display: 'flex', alignItems: 'center',
                              }}
                            >
                              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </div>

                        {/* Checklist de requisitos */}
                        {newPassword.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {pwChecks.map(c => (
                              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <div style={{
                                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                                  background: c.valid ? 'rgba(37,208,102,0.15)' : 'rgba(255,255,255,0.05)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  border: `1px solid ${c.valid ? '#25D066' : 'rgba(255,255,255,0.08)'}`,
                                  transition: 'all 0.2s',
                                }}>
                                  {c.valid && <Check size={8} style={{ color: '#25D066' }} />}
                                </div>
                                <span style={{
                                  fontSize: 11, color: c.valid ? '#25D066' : '#596773',
                                  fontFamily: "'Space Grotesk', sans-serif", transition: 'color 0.2s',
                                }}>
                                  {c.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Erro */}
                        {pwError && (
                          <span style={{
                            fontSize: 12, color: '#f87171',
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}>
                            {pwError}
                          </span>
                        )}

                        {/* Botão salvar */}
                        <button
                          onClick={handleSavePassword}
                          disabled={!pwValid || savingPw}
                          style={{
                            width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                            background: pwValid ? 'linear-gradient(135deg, #25D066 0%, #1BAD53 100%)' : 'rgba(255,255,255,0.05)',
                            color: pwValid ? '#fff' : '#4B5563',
                            fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                            cursor: pwValid ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            boxShadow: pwValid ? '0 4px 14px rgba(37,208,102,0.25)' : 'none',
                          }}
                        >
                          {savingPw ? 'Salvando...' : 'Salvar nova senha'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
