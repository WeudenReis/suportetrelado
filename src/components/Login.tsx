import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface LoginProps {
  onLogin: (email: string, password: string) => void
}

type ToastType = 'error' | 'success' | 'warning'
interface Toast { id: string; type: ToastType; title: string; message: string }

const toastCfg = {
  error:   { icon: AlertTriangle, bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   iconColor: '#f87171', titleColor: '#fca5a5' },
  success: { icon: CheckCircle2,  bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)',   iconColor: '#4ade80', titleColor: '#86efac' },
  warning: { icon: AlertTriangle, bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  iconColor: '#fbbf24', titleColor: '#fcd34d' },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = toastCfg[toast.type]
  const Icon = cfg.icon
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 6000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])
  return (
    <motion.div layout initial={{ opacity: 0, y: -16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.95 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, pointerEvents: 'auto',
        background: cfg.bg, border: `1px solid ${cfg.border}`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 300, maxWidth: 400,
      }}>
      <Icon size={17} style={{ color: cfg.iconColor, marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: cfg.titleColor, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{toast.title}</p>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0', fontFamily: "'Space Grotesk', sans-serif" }}>{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} style={{ padding: 2, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
        <X size={13} />
      </button>
    </motion.div>
  )
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const hash = window.location.hash
    const p1 = new URLSearchParams(hash.replace('#', '?'))
    const p2 = new URLSearchParams(window.location.search)
    const errorDesc = p1.get('error_description') ?? p2.get('error_description')
    if (errorDesc) {
      pushToast('error', 'Falha na autenticação', decodeURIComponent(errorDesc).replace(/\+/g, ' '))
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  function pushToast(type: ToastType, title: string, message: string) {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [{ id, type, title, message }, ...prev])
  }
  function dismissToast(id: string) { setToasts(prev => prev.filter(t => t.id !== id)) }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoadingEmail(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        pushToast('error', 'Login inválido', error.message)
        setLoadingEmail(false)
        return
      }
      onLogin(email, password)
    } catch {
      pushToast('error', 'Erro de rede', 'Verifique sua conexão e tente novamente.')
      setLoadingEmail(false)
    }
  }

  async function handleGoogleLogin() {
    setLoadingGoogle(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      })
      if (error) {
        pushToast('error', 'Erro ao entrar com Google', error.message)
        setLoadingGoogle(false)
      }
    } catch {
      pushToast('error', 'Erro de rede', 'Verifique sua conexão e tente novamente.')
      setLoadingGoogle(false)
    }
  }

  const isLoading = loadingEmail || loadingGoogle

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: '#1d2125', position: 'relative', overflow: 'hidden',
    }}>
      {/* Fundo sutil */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(37,208,102,0.06) 0%, transparent 70%)',
      }} />

      {/* Toasts */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        <AnimatePresence mode="popLayout">
          {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />)}
        </AnimatePresence>
      </div>

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 380 }}>
        {/* Logo + Marca */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: '#25D066',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            boxShadow: '0 8px 24px rgba(37,208,102,0.3)',
          }}>
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
              <rect x="4" y="4" width="92" height="68" rx="12" ry="12" fill="white" />
              <polygon points="50,92 40,68 60,68" fill="white" />
              <circle cx="30" cy="40" r="6" fill="#25D066" />
              <circle cx="50" cy="40" r="6" fill="#25D066" />
              <circle cx="70" cy="40" r="6" fill="#25D066" />
            </svg>
          </div>
          <h1 style={{
            fontFamily: "'Paytone One', sans-serif", fontSize: 26, color: '#fff',
            margin: 0, lineHeight: 1,
          }}>
            chatPro
          </h1>
          <p style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: '#8C96A3',
            margin: '6px 0 0', fontWeight: 400,
          }}>
            Suporte interno
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          style={{
            borderRadius: 16, padding: 28,
            background: '#22272B', border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
          }}
        >
          {/* Botão Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px 0', borderRadius: 12, fontWeight: 600, fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif", cursor: isLoading ? 'not-allowed' : 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#E5E7EB', opacity: isLoading ? 0.4 : 1, transition: 'background 0.15s',
            }}
          >
            {loadingGoogle ? (
              <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            )}
            {loadingGoogle ? 'Conectando...' : 'Entrar com Google'}
          </button>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: '#596773', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: "'Space Grotesk', sans-serif" }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Formulário */}
          <form onSubmit={handleEmailLogin} noValidate>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8C96A3', marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif" }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="voce@empresa.com" autoComplete="email" disabled={isLoading}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                  fontFamily: "'Space Grotesk', sans-serif", color: '#E5E7EB',
                  background: '#1d2125', border: '1px solid rgba(255,255,255,0.08)',
                  outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                  opacity: isLoading ? 0.5 : 1,
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8C96A3', marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif" }}>
                Senha
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" disabled={isLoading}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                  fontFamily: "'Space Grotesk', sans-serif", color: '#E5E7EB',
                  background: '#1d2125', border: '1px solid rgba(255,255,255,0.08)',
                  outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                  opacity: isLoading ? 0.5 : 1,
                }}
              />
            </div>
            <motion.button
              type="submit" disabled={isLoading || !email || !password}
              whileHover={!isLoading ? { scale: 1.01 } : {}}
              whileTap={!isLoading ? { scale: 0.99 } : {}}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                fontWeight: 700, fontSize: 14, color: '#fff', cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
                background: '#25D066', boxShadow: '0 4px 16px rgba(37,208,102,0.25)',
                opacity: (isLoading || !email || !password) ? 0.4 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {loadingEmail ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Entrando...
                </span>
              ) : 'Entrar'}
            </motion.button>
          </form>
        </motion.div>

        {/* Rodapé mínimo */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          style={{
            textAlign: 'center', marginTop: 24, fontSize: 11, color: '#4B5563',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          chatPro · Suporte Interno
        </motion.p>
      </div>
    </div>
  )
}
