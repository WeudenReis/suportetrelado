import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertTriangle, CheckCircle2, Shield, Zap, Activity, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface LoginProps {
  onLogin: (email: string, password: string) => void
}

type ToastType = 'error' | 'success' | 'warning'
interface Toast { id: string; type: ToastType; title: string; message: string }

const SlackLogo = () => (
  <svg width="20" height="20" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/>
    <path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/>
    <path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/>
    <path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/>
  </svg>
)

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
      className="flex items-start gap-3 px-4 py-3.5 rounded-xl pointer-events-auto"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: '320px', maxWidth: '420px' }}>
      <Icon size={17} style={{ color: cfg.iconColor, marginTop: '1px', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight" style={{ color: cfg.titleColor }}>{toast.title}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"><X size={13} /></button>
    </motion.div>
  )
}

const statusItems = [{ label: 'API', ok: true }, { label: 'Supabase', ok: true }, { label: 'Realtime', ok: true }]

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingSlack, setLoadingSlack] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
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

  async function handleSlackLogin() {
    setLoadingSlack(true)
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'slack_oidc', options: { redirectTo } })
      if (error) {
        const msg = error.message.includes('provider is not enabled')
          ? 'O provider Slack não está ativado no Supabase. Ative em Authentication → Providers → Slack.'
          : error.message
        pushToast('error', 'Slack SSO indisponível', msg)
        setLoadingSlack(false)
      }
    } catch {
      pushToast('error', 'Erro inesperado', 'Não foi possível contactar o servidor de autenticação.')
      setLoadingSlack(false)
    }
  }

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

  const isLoading = loadingSlack || loadingEmail

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }
  const onFocusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.08)'
  }
  const onBlurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Subtle bg */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(ellipse 80% 60% at 15% 15%, rgba(37,208,102,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 85% 20%, rgba(27,173,83,0.05) 0%, transparent 55%), radial-gradient(ellipse 70% 60% at 50% 90%, rgba(36,255,114,0.03) 0%, transparent 60%)` }} />

      {/* Toast stack */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />)}
        </AnimatePresence>
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Brand */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col items-center mb-8">
          <div className="mb-4 relative">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#25D066', boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 24px rgba(37,208,102,0.25)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 12h6M9 16h4" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 bg-green-400" style={{ borderColor: 'var(--bg-primary)' }} />
          </div>
          <h1 className="text-[28px] text-white leading-none mb-2" style={{ fontFamily: "'Paytone One', sans-serif" }}>
            Suporte chatPro
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gerencie seus chamados com eficiência.</p>
        </motion.div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl p-8"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>

          {/* Slack button */}
          <motion.button onClick={handleSlackLogin} disabled={isLoading} whileHover={!isLoading ? { scale: 1.025, y: -1 } : {}} whileTap={!isLoading ? { scale: 0.975 } : {}} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-semibold text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: loadingSlack ? 'rgba(74,21,75,0.7)' : 'linear-gradient(135deg, #4A154B 0%, #611a63 100%)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: loadingSlack ? 'none' : '0 4px 16px rgba(74,21,75,0.35)', transition: 'background 0.2s, box-shadow 0.2s' }}>
            {loadingSlack ? <Loader2 size={18} className="animate-spin text-purple-300" /> : <SlackLogo />}
            <span>{loadingSlack ? 'Redirecionando…' : 'Entrar com Slack'}</span>
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            <span className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Email corporativo</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com" autoComplete="email" disabled={isLoading}
                className="w-full rounded-xl px-4 py-3 text-sm placeholder-slate-600 disabled:opacity-50"
                style={{ ...inputStyle, color: 'var(--text-primary)' }} onFocus={onFocusInput} onBlur={onBlurInput} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" disabled={isLoading}
                className="w-full rounded-xl px-4 py-3 text-sm placeholder-slate-600 disabled:opacity-50"
                style={{ ...inputStyle, color: 'var(--text-primary)' }} onFocus={onFocusInput} onBlur={onBlurInput} />
            </div>
            <motion.button type="submit" disabled={isLoading || !email || !password} whileHover={!isLoading ? { scale: 1.015 } : {}} whileTap={!isLoading ? { scale: 0.985 } : {}}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#25D066', boxShadow: '0 4px 16px rgba(37,208,102,0.25)' }}>
              {loadingEmail ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Autenticando…</span> : 'Acessar Plataforma'}
            </motion.button>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.55 }} className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
            {statusItems.map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={s.ok ? { background: '#25D066', boxShadow: '0 0 4px rgba(37,208,102,0.5)' } : { background: '#ef4444' }} />{s.label}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 text-[11px]" style={{ color: '#555' }}>
            <span className="flex items-center gap-1.5"><Shield size={11} />SaaS Interno</span>
            <span className="w-1 h-1 rounded-full" style={{ background: '#333' }} />
            <span className="flex items-center gap-1.5"><Activity size={11} />24/7 Monitoring</span>
            <span className="w-1 h-1 rounded-full" style={{ background: '#333' }} />
            <span className="flex items-center gap-1.5"><Zap size={11} />Realtime Sync</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
