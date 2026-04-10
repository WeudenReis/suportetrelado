import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertTriangle, CheckCircle2, X, ShieldX, Mail, Lock, Eye, EyeOff, ArrowRight, User, CheckCircle, XCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logger } from '../lib/logger'

interface LoginProps {
  onLogin: (email: string) => void
  unauthorizedEmail: string | null
}

type AuthMode = 'login' | 'register' | 'forgot'
type ToastType = 'error' | 'success' | 'warning'
interface Toast { id: string; type: ToastType; title: string; message: string }

interface PasswordCheck {
  label: string
  valid: boolean
}

function validatePassword(pw: string): PasswordCheck[] {
  return [
    { label: 'Mínimo 8 caracteres', valid: pw.length >= 8 },
    { label: 'Uma letra maiúscula', valid: /[A-Z]/.test(pw) },
    { label: 'Um caractere especial (!@#$...)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pw) },
  ]
}

function isPasswordValid(pw: string): boolean {
  return validatePassword(pw).every(c => c.valid)
}

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

export default function Login({ onLogin: _onLogin, unauthorizedEmail }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingRegister, setLoadingRegister] = useState(false)
  const [loadingReset, setLoadingReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<HTMLDivElement>(null)
  const captchaWidgetId = useRef<number | null>(null)
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''

  const passwordChecks = validatePassword(registerPassword)

  // Carregar script do reCAPTCHA
  useEffect(() => {
    if (!recaptchaSiteKey) return
    const existingScript = document.querySelector('script[src*="recaptcha"]')
    if (existingScript) return

    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit'
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    ;(window as unknown as Record<string, unknown>).onRecaptchaLoad = () => {
      if (captchaRef.current && window.grecaptcha && captchaWidgetId.current === null) {
        captchaWidgetId.current = window.grecaptcha.render(captchaRef.current, {
          sitekey: recaptchaSiteKey,
          callback: (token: string) => setCaptchaToken(token),
          'expired-callback': () => setCaptchaToken(null),
          theme: 'dark',
          size: 'normal',
        })
      }
    }

    return () => {
      delete (window as unknown as Record<string, unknown>).onRecaptchaLoad
    }
  }, [recaptchaSiteKey])

  // Renderizar widget quando o reCAPTCHA já estiver carregado
  useEffect(() => {
    if (!recaptchaSiteKey || !captchaRef.current || captchaWidgetId.current !== null) return
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        if (captchaRef.current && window.grecaptcha && captchaWidgetId.current === null) {
          captchaWidgetId.current = window.grecaptcha.render(captchaRef.current, {
            sitekey: recaptchaSiteKey,
            callback: (token: string) => setCaptchaToken(token),
            'expired-callback': () => setCaptchaToken(null),
            theme: 'dark',
            size: 'normal',
          })
        }
      })
    }
  }, [recaptchaSiteKey])

  function pushToast(type: ToastType, title: string, message: string) {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [{ id, type, title, message }, ...prev])
  }
  function dismissToast(id: string) { setToasts(prev => prev.filter(t => t.id !== id)) }

  useEffect(() => {
    const hash = window.location.hash
    const p1 = new URLSearchParams(hash.replace('#', '?'))
    const p2 = new URLSearchParams(window.location.search)
    const errorDesc = p1.get('error_description') ?? p2.get('error_description')
    if (errorDesc) {
      pushToast('error', 'Falha na autenticação', decodeURIComponent(errorDesc).replace(/\+/g, ' '))
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [pushToast])

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      pushToast('warning', 'Informe o e-mail', 'Digite seu e-mail para receber o link de redefinição.')
      return
    }
    setLoadingReset(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      })
      if (error) {
        pushToast('error', 'Erro ao enviar', error.message)
      } else {
        pushToast('success', 'E-mail enviado!', 'Verifique sua caixa de entrada para redefinir sua senha.')
      }
    } catch {
      pushToast('error', 'Erro de rede', 'Verifique sua conexão e tente novamente.')
    } finally {
      setLoadingReset(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      pushToast('error', 'Campos obrigatórios', 'Preencha o e-mail e a senha para continuar.')
      return
    }
    if (!isSupabaseConfigured) {
      pushToast('error', 'Erro de configuração', 'As variáveis de ambiente do Supabase não estão configuradas.')
      return
    }
    if (recaptchaSiteKey && !captchaToken) {
      pushToast('warning', 'Verificação necessária', 'Complete o reCAPTCHA antes de continuar.')
      return
    }
    setLoadingEmail(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })
      if (error) {
        pushToast('error', 'Erro ao entrar', error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message)
        resetCaptcha()
      }
    } catch {
      pushToast('error', 'Erro de rede', 'Verifique sua conexão e tente novamente.')
      resetCaptcha()
    } finally {
      setLoadingEmail(false)
    }
  }

  function resetCaptcha() {
    setCaptchaToken(null)
    if (window.grecaptcha && captchaWidgetId.current !== null) {
      window.grecaptcha.reset(captchaWidgetId.current)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!registerName.trim()) {
      pushToast('error', 'Nome obrigatório', 'Informe seu nome de usuário.')
      return
    }
    if (!registerEmail.trim()) {
      pushToast('error', 'E-mail obrigatório', 'Informe seu e-mail.')
      return
    }
    if (!isPasswordValid(registerPassword)) {
      pushToast('error', 'Senha fraca', 'A senha deve ter 8+ caracteres, 1 maiúscula e 1 caractere especial.')
      return
    }
    if (registerPassword !== registerConfirmPassword) {
      pushToast('error', 'Senhas diferentes', 'A confirmação de senha não confere.')
      return
    }
    if (!isSupabaseConfigured) {
      pushToast('error', 'Erro de configuração', 'As variáveis de ambiente do Supabase não estão configuradas.')
      return
    }
    if (recaptchaSiteKey && !captchaToken) {
      pushToast('warning', 'Verificação necessária', 'Complete o reCAPTCHA antes de continuar.')
      return
    }
    setLoadingRegister(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: registerEmail.trim(),
        password: registerPassword,
        options: {
          data: {
            full_name: registerName.trim(),
            name: registerName.trim(),
          },
          emailRedirectTo: window.location.origin,
        },
      })
      logger.debug('Login', 'signUp response', { hasData: !!data, error: error?.message })
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          pushToast('error', 'E-mail já cadastrado', 'Este e-mail já possui uma conta. Faça login.')
        } else {
          pushToast('error', 'Erro ao criar conta', error.message)
        }
        resetCaptcha()
      } else if (data?.user?.identities?.length === 0) {
        // Supabase retorna user sem identities quando o e-mail já existe
        pushToast('error', 'E-mail já cadastrado', 'Este e-mail já possui uma conta. Faça login.')
        resetCaptcha()
      } else if (data?.session) {
        // Login automático (confirmação de e-mail desabilitada)
        pushToast('success', 'Conta criada!', 'Você foi conectado automaticamente.')
      } else {
        // Confirmação de e-mail necessária
        pushToast('success', 'Conta criada!', 'Verifique seu e-mail para confirmar o cadastro e depois faça login.')
        setMode('login')
        setEmail(registerEmail.trim())
        setRegisterName('')
        setRegisterEmail('')
        setRegisterPassword('')
        setRegisterConfirmPassword('')
        resetCaptcha()
      }
    } catch {
      pushToast('error', 'Erro de rede', 'Verifique sua conexão e tente novamente.')
      resetCaptcha()
    } finally {
      setLoadingRegister(false)
    }
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode)
    resetCaptcha()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px 12px 42px', borderRadius: 10, fontSize: 14,
    fontFamily: "'Space Grotesk', sans-serif", color: '#E5E7EB', background: '#1d2125',
    border: '1px solid rgba(255,255,255,0.08)', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const inputFocusStyle = (el: HTMLInputElement) => {
    el.style.borderColor = '#25D066'
    el.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.12)'
  }
  const inputBlurStyle = (el: HTMLInputElement) => {
    el.style.borderColor = 'rgba(255,255,255,0.08)'
    el.style.boxShadow = 'none'
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: '#1d2125', position: 'relative', overflow: 'hidden',
    }}>
      {/* Fundo gradiente */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(37,208,102,0.08) 0%, transparent 60%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(ellipse 40% 40% at 80% 80%, rgba(37,208,102,0.04) 0%, transparent 60%)',
      }} />

      {/* Toasts */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        <AnimatePresence mode="popLayout">
          {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />)}
        </AnimatePresence>
      </div>

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 400 }}>
        {/* Logo + Marca */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}
        >
          <div style={{
            width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #25D066 0%, #1BAD53 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
            boxShadow: '0 12px 32px rgba(37,208,102,0.25), 0 4px 12px rgba(37,208,102,0.15)',
          }}>
            <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
              <rect x="4" y="4" width="92" height="68" rx="12" ry="12" fill="white" />
              <polygon points="50,92 40,68 60,68" fill="white" />
              <circle cx="30" cy="40" r="6" fill="#25D066" />
              <circle cx="50" cy="40" r="6" fill="#25D066" />
              <circle cx="70" cy="40" r="6" fill="#25D066" />
            </svg>
          </div>
          <h1 style={{
            fontFamily: "'Paytone One', sans-serif", fontSize: 30, color: '#fff',
            margin: 0, lineHeight: 1, letterSpacing: '-0.01em',
          }}>
            Trelado
          </h1>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          style={{
            borderRadius: 20, padding: '32px 28px',
            background: '#22272B', border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)',
          }}
        >
          {/* Título do card */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700,
              color: '#E5E7EB', margin: 0,
            }}>
              {mode === 'login' ? 'Acessar sua conta' : mode === 'register' ? 'Criar sua conta' : 'Redefinir senha'}
            </h2>
            <p style={{
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: '#6B7685',
              margin: '6px 0 0',
            }}>
              {mode === 'login' ? 'Entre com seu e-mail e senha' : mode === 'register' ? 'Preencha os dados abaixo para se cadastrar' : 'Informe seu e-mail para receber o link de redefinição'}
            </p>
          </div>

          {/* Aviso de acesso negado */}
          {unauthorizedEmail && mode === 'login' && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              marginBottom: 20,
            }}>
              <ShieldX size={18} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fca5a5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                  Acesso não autorizado
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.4 }}>
                  A conta <strong style={{ color: '#E5E7EB' }}>{unauthorizedEmail}</strong> não tem permissão. Peça acesso ao administrador.
                </p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {mode === 'login' && (
              <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
                {/* Formulário de e-mail e senha */}
                <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* E-mail */}
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#596773', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      placeholder="Seu e-mail"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={e => inputFocusStyle(e.currentTarget)}
                      onBlur={e => inputBlurStyle(e.currentTarget)}
                      style={inputStyle}
                      autoComplete="email"
                    />
                  </div>

                  {/* Senha */}
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#596773', pointerEvents: 'none' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Sua senha"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={e => inputFocusStyle(e.currentTarget)}
                      onBlur={e => inputBlurStyle(e.currentTarget)}
                      style={{ ...inputStyle, paddingRight: 42 }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#9fadbc' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#596773' }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Botão Entrar */}
                  <button
                    type="submit"
                    disabled={loadingEmail || (!!recaptchaSiteKey && !captchaToken)}
                    onMouseEnter={e => { if (!loadingEmail) e.currentTarget.style.background = '#1BAD53' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#25D066' }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                      fontFamily: "'Space Grotesk', sans-serif", cursor: loadingEmail ? 'not-allowed' : 'pointer',
                      background: '#25D066', border: 'none', color: '#fff',
                      opacity: loadingEmail ? 0.6 : 1, transition: 'background 0.15s, opacity 0.15s',
                      boxShadow: '0 4px 16px rgba(37,208,102,0.25)',
                      marginTop: 4,
                    }}
                  >
                    {loadingEmail ? (
                      <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                    {loadingEmail ? 'Entrando...' : 'Entrar'}
                  </button>
                </form>

                {/* Esqueci minha senha */}
                <div style={{ textAlign: 'right', marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    style={{
                      background: 'none', border: 'none', color: '#596773', cursor: 'pointer',
                      fontSize: 12, fontFamily: "'Space Grotesk', sans-serif",
                      padding: 0, textDecoration: 'none',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#25D066'; e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#596773'; e.currentTarget.style.textDecoration = 'none' }}
                  >
                    Esqueci minha senha
                  </button>
                </div>

                {/* Link para cadastro */}
                <p style={{
                  textAlign: 'center', marginTop: 20, marginBottom: 0, fontSize: 13, color: '#6B7685',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  Não tem uma conta?{' '}
                  <button
                    onClick={() => switchMode('register')}
                    style={{
                      background: 'none', border: 'none', color: '#25D066', cursor: 'pointer',
                      fontWeight: 600, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
                      textDecoration: 'none', padding: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                  >
                    Criar conta
                  </button>
                </p>
              </motion.div>
            )}

            {mode === 'register' && (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                {/* Formulário de cadastro */}
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Nome */}
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#596773', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Nome de usuário"
                      value={registerName}
                      onChange={e => setRegisterName(e.target.value)}
                      onFocus={e => inputFocusStyle(e.currentTarget)}
                      onBlur={e => inputBlurStyle(e.currentTarget)}
                      style={inputStyle}
                      autoComplete="name"
                    />
                  </div>

                  {/* E-mail */}
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#596773', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      placeholder="Seu e-mail"
                      value={registerEmail}
                      onChange={e => setRegisterEmail(e.target.value)}
                      onFocus={e => inputFocusStyle(e.currentTarget)}
                      onBlur={e => inputBlurStyle(e.currentTarget)}
                      style={inputStyle}
                      autoComplete="email"
                    />
                  </div>

                  {/* Senha */}
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#596773', pointerEvents: 'none' }} />
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      placeholder="Criar senha"
                      value={registerPassword}
                      onChange={e => setRegisterPassword(e.target.value)}
                      onFocus={e => inputFocusStyle(e.currentTarget)}
                      onBlur={e => inputBlurStyle(e.currentTarget)}
                      style={{ ...inputStyle, paddingRight: 42 }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(p => !p)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#9fadbc' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#596773' }}
                      tabIndex={-1}
                    >
                      {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Indicadores de força da senha */}
                  {registerPassword.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}>
                      {passwordChecks.map((check, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {check.valid ? (
                            <CheckCircle size={13} style={{ color: '#25D066', flexShrink: 0 }} />
                          ) : (
                            <XCircle size={13} style={{ color: '#596773', flexShrink: 0 }} />
                          )}
                          <span style={{
                            fontSize: 11, fontFamily: "'Space Grotesk', sans-serif",
                            color: check.valid ? '#25D066' : '#596773',
                            transition: 'color 0.2s',
                          }}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confirmar senha */}
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#596773', pointerEvents: 'none' }} />
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      placeholder="Confirmar senha"
                      value={registerConfirmPassword}
                      onChange={e => setRegisterConfirmPassword(e.target.value)}
                      onFocus={e => inputFocusStyle(e.currentTarget)}
                      onBlur={e => inputBlurStyle(e.currentTarget)}
                      style={inputStyle}
                      autoComplete="new-password"
                    />
                    {registerConfirmPassword.length > 0 && (
                      <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                        {registerPassword === registerConfirmPassword ? (
                          <CheckCircle size={16} style={{ color: '#25D066' }} />
                        ) : (
                          <XCircle size={16} style={{ color: '#f87171' }} />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botão Criar conta */}
                  <button
                    type="submit"
                    disabled={loadingRegister || !isPasswordValid(registerPassword) || registerPassword !== registerConfirmPassword || (!!recaptchaSiteKey && !captchaToken)}
                    onMouseEnter={e => { if (!loadingRegister) e.currentTarget.style.background = '#1BAD53' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#25D066' }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                      fontFamily: "'Space Grotesk', sans-serif", cursor: loadingRegister ? 'not-allowed' : 'pointer',
                      background: '#25D066', border: 'none', color: '#fff',
                      opacity: (loadingRegister || !isPasswordValid(registerPassword) || registerPassword !== registerConfirmPassword) ? 0.5 : 1,
                      transition: 'background 0.15s, opacity 0.15s',
                      boxShadow: '0 4px 16px rgba(37,208,102,0.25)',
                      marginTop: 4,
                    }}
                  >
                    {loadingRegister ? (
                      <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                    {loadingRegister ? 'Criando conta...' : 'Criar conta'}
                  </button>
                </form>

                {/* Link para login */}
                <p style={{
                  textAlign: 'center', marginTop: 20, marginBottom: 0, fontSize: 13, color: '#6B7685',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  Já tem uma conta?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'none', border: 'none', color: '#25D066', cursor: 'pointer',
                      fontWeight: 600, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
                      textDecoration: 'none', padding: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                  >
                    Fazer login
                  </button>
                </p>
              </motion.div>
            )}

            {mode === 'forgot' && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* E-mail */}
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#596773', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      placeholder="Seu e-mail cadastrado"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={e => inputFocusStyle(e.currentTarget)}
                      onBlur={e => inputBlurStyle(e.currentTarget)}
                      style={inputStyle}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  {/* Botão Enviar link */}
                  <button
                    type="submit"
                    disabled={loadingReset || !email.trim()}
                    onMouseEnter={e => { if (!loadingReset) e.currentTarget.style.background = '#1BAD53' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#25D066' }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                      fontFamily: "'Space Grotesk', sans-serif", cursor: loadingReset ? 'not-allowed' : 'pointer',
                      background: '#25D066', border: 'none', color: '#fff',
                      opacity: (loadingReset || !email.trim()) ? 0.5 : 1,
                      transition: 'background 0.15s, opacity 0.15s',
                      boxShadow: '0 4px 16px rgba(37,208,102,0.25)',
                      marginTop: 4,
                    }}
                  >
                    {loadingReset ? (
                      <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Mail size={17} />
                    )}
                    {loadingReset ? 'Enviando...' : 'Enviar link de redefinição'}
                  </button>
                </form>

                {/* Voltar para login */}
                <p style={{
                  textAlign: 'center', marginTop: 20, marginBottom: 0, fontSize: 13, color: '#6B7685',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  Lembrou a senha?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'none', border: 'none', color: '#25D066', cursor: 'pointer',
                      fontWeight: 600, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
                      textDecoration: 'none', padding: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                  >
                    Voltar ao login
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* reCAPTCHA — fora da alternância para manter o widget montado */}
          {recaptchaSiteKey && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <div ref={captchaRef} />
            </div>
          )}

          <p style={{
            textAlign: 'center', marginTop: 18, marginBottom: 0, fontSize: 11, color: '#4B5563',
            fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.5,
          }}>
            Somente contas autorizadas pelo administrador podem acessar a plataforma.
          </p>
        </motion.div>

        {/* Rodapé */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          style={{
            textAlign: 'center', marginTop: 28, fontSize: 11, color: '#3B4754',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          © {new Date().getFullYear()} Trelado
        </motion.p>
      </div>
    </div>
  )
}
