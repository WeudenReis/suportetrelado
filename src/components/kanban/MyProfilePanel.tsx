import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import UserAvatar from '../ui/UserAvatar'
import AvatarCropModal from './AvatarCropModal'
import { uploadUserAvatar, updateUserAvatarUrl, deleteUserAvatarObject } from '../../lib/api/userAvatars'

interface ProfileData {
  name: string
  email: string
  avatarColor: string
  avatarUrl: string | null
}

export default function MyProfilePanel({ onClose }: { onClose: () => void }) {
  const [profile, setProfile]        = useState<ProfileData | null>(null)
  const [loadingProfile, setLoading] = useState(true)

  // Edição de nome
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue]     = useState('')
  const [savingName, setSavingName]   = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true)

  // Avatar customizado
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Alteração de senha
  const [showPwSection, setShowPwSection]   = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [showCurrentPw, setShowCurrentPw]   = useState(false)
  const [showNewPw, setShowNewPw]           = useState(false)
  const [savingPw, setSavingPw]             = useState(false)
  const [pwSuccess, setPwSuccess]           = useState(false)
  const [pwError, setPwError]               = useState<string | null>(null)

  const pwValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword)

  // ── Carregar perfil ──
  useEffect(() => {
    async function load() {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const email = authData?.user?.email ?? ''
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('name, email, avatar_color, avatar_url')
          .eq('email', email)
          .maybeSingle()
        setProfile({
          name:        prof?.name || email.split('@')[0],
          email:       prof?.email || email,
          avatarColor: prof?.avatar_color || '#579DFF',
          avatarUrl:   prof?.avatar_url || null,
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

  // ── Gerar senha segura ──
  function generatePassword(): string {
    const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower   = 'abcdefghijklmnopqrstuvwxyz'
    const digits  = '0123456789'
    const special = '!@#$%&*'
    const all = upper + lower + digits + special
    let pw = upper[Math.floor(Math.random() * upper.length)]
           + special[Math.floor(Math.random() * special.length)]
           + digits[Math.floor(Math.random() * digits.length)]
    for (let i = 0; i < 5; i++) pw += all[Math.floor(Math.random() * all.length)]
    return pw.split('').sort(() => Math.random() - 0.5).join('')
  }

  // ── Alterar senha ──
  const handleSavePassword = useCallback(async () => {
    if (!pwValid || !currentPassword.trim() || !profile) return
    setSavingPw(true)
    setPwError(null)
    try {
      // Reautenticar com senha atual
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword.trim(),
      })
      if (authErr) {
        setPwError('Senha atual incorreta. Verifique e tente novamente.')
        return
      }
      // Aplicar nova senha
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPwError('Falha ao alterar senha. Tente novamente.')
        logger.error('MyProfilePanel', 'Falha ao alterar senha', { error: error.message })
        return
      }
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setShowCurrentPw(false)
      setShowNewPw(false)
      setTimeout(() => { setPwSuccess(false); setShowPwSection(false) }, 3000)
    } catch (err) {
      setPwError('Erro inesperado. Verifique sua conexão.')
      logger.error('MyProfilePanel', 'Exceção ao alterar senha', { error: String(err) })
    } finally {
      setSavingPw(false)
    }
  }, [pwValid, currentPassword, newPassword, profile])

  // ── Avatar: upload ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-selecionar o mesmo arquivo
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Selecione uma imagem (JPG, PNG, WebP).')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarError('Imagem muito grande (máx. 8MB).')
      return
    }
    setAvatarError(null)
    setPendingFile(file)
  }

  const handleSaveCroppedAvatar = useCallback(async (blob: Blob) => {
    if (!profile) return
    setSavingAvatar(true)
    setAvatarError(null)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id
      if (!userId) {
        setAvatarError('Sessão expirada. Faça login novamente.')
        return
      }
      const previousPath = profile.avatarUrl
      const uploaded = await uploadUserAvatar(blob, userId, 'webp')
      if (!uploaded) {
        setAvatarError('Falha ao enviar a imagem. Tente novamente.')
        return
      }
      const ok = await updateUserAvatarUrl(profile.email, uploaded.storage_path)
      if (!ok) {
        setAvatarError('Falha ao salvar a foto no perfil.')
        return
      }
      setProfile(prev => prev ? { ...prev, avatarUrl: uploaded.storage_path } : prev)
      setPendingFile(null)
      // Apaga o avatar anterior (se houver) — best-effort
      if (previousPath && previousPath !== uploaded.storage_path && !/^(https?:|data:|blob:)/i.test(previousPath)) {
        deleteUserAvatarObject(previousPath)
      }
    } catch (err) {
      setAvatarError('Erro inesperado ao salvar foto.')
      logger.error('MyProfilePanel', 'Falha ao salvar avatar', { error: String(err) })
    } finally {
      setSavingAvatar(false)
    }
  }, [profile])

  const handleRemoveAvatar = useCallback(async () => {
    if (!profile?.avatarUrl) return
    if (!confirm('Remover sua foto de perfil?')) return
    setSavingAvatar(true)
    setAvatarError(null)
    try {
      const previousPath = profile.avatarUrl
      const ok = await updateUserAvatarUrl(profile.email, null)
      if (!ok) {
        setAvatarError('Falha ao remover a foto.')
        return
      }
      setProfile(prev => prev ? { ...prev, avatarUrl: null } : prev)
      if (previousPath && !/^(https?:|data:|blob:)/i.test(previousPath)) {
        deleteUserAvatarObject(previousPath)
      }
    } finally {
      setSavingAvatar(false)
    }
  }, [profile])

  function resetPwFields() {
    setCurrentPassword('')
    setNewPassword('')
    setShowCurrentPw(false)
    setShowNewPw(false)
    setPwError(null)
    setShowPwSection(false)
  }

  // ── Estilos compartilhados ──
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, fontSize: 14,
    fontFamily: "'Space Grotesk', sans-serif", color: '#E5E7EB', background: '#1d2125',
    border: '1px solid rgba(255,255,255,0.06)', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
  }

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Meu perfil"
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
              <Icon name="User" size={18} style={{ color: '#fff' }} />
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
            <Icon name="X" size={15} />
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
              {/* ── Card de identidade ── */}
              <div style={{
                background: '#22272B', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.04)',
                padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                {/* Avatar + nome */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <UserAvatar
                      name={profile.name}
                      avatarColor={profile.avatarColor}
                      avatarUrl={profile.avatarUrl}
                      size={52}
                      borderRadius={16}
                      fontSize={18}
                      boxShadow={`0 4px 16px ${profile.avatarColor}40`}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={savingAvatar}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={savingAvatar}
                      title={profile.avatarUrl ? 'Trocar foto' : 'Adicionar foto'}
                      style={{
                        position: 'absolute', right: -4, bottom: -4,
                        width: 24, height: 24, borderRadius: 8, border: '2px solid #22272B',
                        background: '#25D066', color: '#1d2125',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: savingAvatar ? 'wait' : 'pointer', padding: 0,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        transition: 'transform 0.12s, background 0.12s',
                      }}
                      onMouseEnter={e => { if (!savingAvatar) e.currentTarget.style.transform = 'scale(1.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      {savingAvatar
                        ? <Icon name="Spinner" size={11} spin />
                        : <Icon name="Camera" size={11} />
                      }
                    </button>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#596773', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Nome exibido
                    </span>
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
                            flex: 1, minWidth: 0, padding: '4px 10px', borderRadius: 8,
                            fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                            color: '#E5E7EB', background: 'rgba(255,255,255,0.05)',
                            border: '1px solid #25D066', outline: 'none',
                            boxShadow: '0 0 0 2px rgba(37,208,102,0.15)',
                          }}
                        />
                        <button onClick={handleSaveName} disabled={savingName} title="Confirmar"
                          style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'rgba(37,208,102,0.18)', color: '#25D066', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.32)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.18)' }}>
                          <Icon name="Check" size={13} />
                        </button>
                        <button onClick={() => { setEditingName(false); setNameValue(profile.name) }} title="Cancelar"
                          style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.05)', color: '#596773', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#596773' }}>
                          <Icon name="X" size={13} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#E5E7EB', fontFamily: "'Space Grotesk', sans-serif" }}>
                          {profile.name}
                        </span>
                        <button onClick={() => { setNameValue(profile.name); setEditingName(true) }} title="Editar nome"
                          style={{ width: 20, height: 20, borderRadius: 5, border: 'none', background: 'transparent', color: '#4B5563', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'color 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#25D066' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#4B5563' }}>
                          <Icon name="Pencil" size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Erro de avatar / botão remover foto */}
                {(avatarError || profile.avatarUrl) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: -4 }}>
                    {avatarError ? (
                      <span style={{ fontSize: 11, color: '#f87171', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {avatarError}
                      </span>
                    ) : <span />}
                    {profile.avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={savingAvatar}
                        style={{
                          background: 'transparent', border: 'none', color: '#596773',
                          fontSize: 11, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
                          cursor: savingAvatar ? 'wait' : 'pointer', padding: '2px 4px',
                          textDecoration: 'underline',
                        }}
                        onMouseEnter={e => { if (!savingAvatar) e.currentTarget.style.color = '#f87171' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#596773' }}
                      >
                        Remover foto
                      </button>
                    )}
                  </div>
                )}

                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                {/* E-mail */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#596773', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    E-mail
                  </span>
                  <p style={{ fontSize: 13, color: '#9FADBC', margin: '4px 0 0', fontFamily: "'Space Grotesk', sans-serif", wordBreak: 'break-all' }}>
                    {profile.email}
                  </p>
                </div>
              </div>

              {/* ── Seção alterar senha ── */}
              <div style={{
                background: '#22272B', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.04)',
                overflow: 'hidden',
              }}>
                {/* Cabeçalho clicável */}
                <button
                  onClick={() => { setShowPwSection(p => !p); setPwError(null) }}
                  style={{
                    width: '100%', padding: '16px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {pwSuccess
                      ? <Icon name="CheckCircle2" size={16} style={{ color: '#25D066' }} />
                      : <Icon name="KeyRound" size={16} style={{ color: '#579DFF' }} />
                    }
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      color: pwSuccess ? '#25D066' : '#E5E7EB',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}>
                      {pwSuccess ? 'Senha alterada com sucesso!' : 'Redefinir senha'}
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
                      <div style={{ padding: '0 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                        {/* Senha atual */}
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7685', fontFamily: "'Space Grotesk', sans-serif", display: 'block', marginBottom: 6 }}>
                            Sua senha atual
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showCurrentPw ? 'text' : 'password'}
                              placeholder="Confirme sua identidade"
                              value={currentPassword}
                              onChange={e => { setCurrentPassword(e.target.value); setPwError(null) }}
                              disabled={savingPw}
                              style={inputStyle}
                              onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
                            />
                            <button type="button" onClick={() => setShowCurrentPw(p => !p)}
                              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                              {showCurrentPw ? <Icon name="EyeOff" size={15} /> : <Icon name="Eye" size={15} />}
                            </button>
                          </div>
                        </div>

                        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />

                        {/* Nova senha */}
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7685', fontFamily: "'Space Grotesk', sans-serif", display: 'block', marginBottom: 6 }}>
                            Nova senha
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showNewPw ? 'text' : 'password'}
                              placeholder="Criar nova senha"
                              value={newPassword}
                              onChange={e => { setNewPassword(e.target.value); setPwError(null) }}
                              onKeyDown={e => { if (e.key === 'Enter') handleSavePassword() }}
                              disabled={savingPw}
                              style={{ ...inputStyle, paddingRight: newPassword ? '76px' : '44px' }}
                              onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
                            />
                            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 2 }}>
                              <button type="button" onClick={() => setShowNewPw(p => !p)}
                                style={{ background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                                {showNewPw ? <Icon name="EyeOff" size={15} /> : <Icon name="Eye" size={15} />}
                              </button>
                              {newPassword && (
                                <button type="button" onClick={() => navigator.clipboard.writeText(newPassword).catch(() => {})} title="Copiar senha"
                                  style={{ background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                                  <Icon name="Copy" size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Gerar senha segura */}
                        <button
                          type="button"
                          onClick={() => { const pw = generatePassword(); setNewPassword(pw); setShowNewPw(true) }}
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

                        {/* Erro */}
                        {pwError && (
                          <span style={{ fontSize: 12, color: '#f87171', fontFamily: "'Space Grotesk', sans-serif" }}>
                            {pwError}
                          </span>
                        )}

                        {/* Botões Cancelar / Redefinir */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                          <button
                            type="button"
                            onClick={resetPwFields}
                            disabled={savingPw}
                            style={{
                              flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                              background: 'rgba(255,255,255,0.05)', color: '#9FADBC',
                              fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
                              cursor: 'pointer', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSavePassword}
                            disabled={!pwValid || !currentPassword.trim() || savingPw}
                            style={{
                              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                              background: (pwValid && currentPassword.trim())
                                ? 'linear-gradient(135deg, #25D066 0%, #1BAD53 100%)'
                                : 'rgba(255,255,255,0.05)',
                              color: (pwValid && currentPassword.trim()) ? '#fff' : '#4B5563',
                              fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                              cursor: (pwValid && currentPassword.trim()) ? 'pointer' : 'not-allowed',
                              transition: 'all 0.2s',
                              boxShadow: (pwValid && currentPassword.trim()) ? '0 4px 14px rgba(37,208,102,0.25)' : 'none',
                            }}
                          >
                            {savingPw ? 'Salvando...' : 'Redefinir senha'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {pendingFile && (
        <AvatarCropModal
          file={pendingFile}
          onSave={handleSaveCroppedAvatar}
          onClose={() => setPendingFile(null)}
        />
      )}
    </motion.div>
  )
}
