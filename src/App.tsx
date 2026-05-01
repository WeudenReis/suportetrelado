import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Icon } from './lib/icons'
import { animate } from 'framer-motion'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import { OrgProvider } from './lib/org'
import { useOrg } from './lib/orgContext'
import { NotificationProvider } from './components/NotificationContext'
import { useNotificationContext } from './components/useNotificationContext'
import { AnnouncementProvider } from './components/AnnouncementContext'
import { SearchProvider } from './components/SearchContext'
import ErrorBoundary from './components/ErrorBoundary'
import { initSentry, setSentryUser, captureException } from './lib/sentry'
import { logger } from './lib/logger'
import { installOfflineListener, registerOfflineExecutor } from './lib/offlineQueue'
import { insertComment } from './lib/api/comments'
import { insertTicket, updateTicket } from './lib/api/tickets'
import type { TicketInsert } from './lib/supabase'
import { isSuperAdmin } from './lib/superAdmins'
import Login from './components/Login'
import Workspace from './components/Workspace'
import AppHeader, { type SidebarTab } from './components/layout/AppHeader'
import { fetchTickets, upsertUserProfile, updateLastSeen, checkAuthorizedUser } from './lib/supabase'
import type { Ticket } from './lib/supabase'

type AppTab = SidebarTab | 'board'

const InboxSidebar = lazy(() => import('./components/InboxView'))
const PlannerSidebar = lazy(() => import('./components/PlannerSidebar'))
const AnnouncementsView = lazy(() => import('./components/AnnouncementsView'))
const LinksView = lazy(() => import('./components/LinksView'))
const Onboarding = lazy(() => import('./components/Onboarding'))
const WhatsNew = lazy(() => import('./components/WhatsNew'))

function SidebarSpinner() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#596773', padding: 40 }}>
      <Icon name="Loader2" size={24} className="animate-spin" />
    </div>
  )
}

// Inicializar Sentry no carregamento do módulo
initSentry()

// Fila offline: reprocessa mutações que falharam por falta de rede
registerOfflineExecutor('insertComment', async (args) => {
  const { ticketId, userName, content, departmentId } = args as {
    ticketId: string; userName: string; content: string; departmentId?: string
  }
  await insertComment(ticketId, userName, content, departmentId)
})
registerOfflineExecutor('insertTicket', async (args) => {
  const { ticket } = args as { ticket: TicketInsert }
  await insertTicket(ticket)
})
registerOfflineExecutor('updateTicket', async (args) => {
  const { id, updates } = args as { id: string; updates: Partial<Ticket> }
  await updateTicket(id, updates)
})
installOfflineListener()

function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const checks = [
    { label: 'Mínimo 8 caracteres', valid: newPassword.length >= 8 },
    { label: 'Uma letra maiúscula', valid: /[A-Z]/.test(newPassword) },
    { label: 'Um caractere especial (!@#$...)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword) },
  ]
  const isValid = checks.every(c => c.valid) && newPassword === confirmPassword && confirmPassword.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword })
      if (err) {
        setError(err.message)
      } else {
        setSuccess(true)
        await supabase.auth.signOut()
        setTimeout(onDone, 2000)
      }
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px 12px 14px', borderRadius: 10, fontSize: 14,
    fontFamily: "'Space Grotesk', sans-serif", color: '#E5E7EB', background: '#1d2125',
    border: '1px solid rgba(255,255,255,0.08)', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: '#1d2125', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(37,208,102,0.08) 0%, transparent 60%)',
      }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #25D066 0%, #1BAD53 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
            boxShadow: '0 12px 32px rgba(37,208,102,0.25)',
          }}>
            <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
              <rect x="4" y="4" width="92" height="68" rx="12" ry="12" fill="white" />
              <polygon points="50,92 40,68 60,68" fill="white" />
              <circle cx="30" cy="40" r="6" fill="#25D066" />
              <circle cx="50" cy="40" r="6" fill="#25D066" />
              <circle cx="70" cy="40" r="6" fill="#25D066" />
            </svg>
          </div>
          <h1 style={{ fontFamily: "'Paytone One', sans-serif", fontSize: 30, color: '#fff', margin: 0 }}>chatPro</h1>
        </div>

        {/* Card */}
        <div style={{
          borderRadius: 20, padding: '32px 28px',
          background: '#22272B', border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              {success ? 'Senha redefinida!' : 'Definir nova senha'}
            </h2>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: '#6B7685', margin: '6px 0 0' }}>
              {success ? 'Você será redirecionado em instantes...' : 'Crie uma senha segura para sua conta'}
            </p>
          </div>

          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'rgba(37,208,102,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#25D066" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: '#25D066', fontWeight: 600 }}>
                Senha alterada com sucesso!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nova senha"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
                  style={{ ...inputStyle, paddingRight: 42 }}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#596773', cursor: 'pointer', padding: 4,
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Validação visual */}
              {newPassword.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}>
                  {checks.map((check, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: check.valid ? '#25D066' : '#596773' }}>
                        {check.valid ? '✓' : '○'}
                      </span>
                      <span style={{
                        fontSize: 11, fontFamily: "'Space Grotesk', sans-serif",
                        color: check.valid ? '#25D066' : '#596773',
                      }}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.12)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
                style={inputStyle}
                autoComplete="new-password"
              />

              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p style={{ fontSize: 11, color: '#f87171', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                  As senhas não coincidem
                </p>
              )}

              {error && (
                <p style={{ fontSize: 12, color: '#f87171', margin: 0, fontFamily: "'Space Grotesk', sans-serif", textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!isValid || saving}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                  fontFamily: "'Space Grotesk', sans-serif", cursor: (!isValid || saving) ? 'not-allowed' : 'pointer',
                  background: '#25D066', border: 'none', color: '#fff',
                  opacity: (!isValid || saving) ? 0.5 : 1,
                  transition: 'background 0.15s, opacity 0.15s',
                  boxShadow: '0 4px 16px rgba(37,208,102,0.25)',
                  marginTop: 4,
                }}
              >
                {saving ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: '#3B4754', fontFamily: "'Space Grotesk', sans-serif" }}>
          © {new Date().getFullYear()} chatPro
        </p>
      </div>
    </div>
  )
}

/* ── Tela de conta autenticada mas sem vínculo org ── */
function PendingAccessScreen({ user, onLogout }: { user: string; onLogout: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#1d2125', fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 440, margin: '0 24px',
        background: '#22272b', borderRadius: 20, padding: '44px 40px',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>
        {/* Ícone */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #25D066 0%, #1BAD53 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(37,208,102,0.25)',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        {/* Título */}
        <h1 style={{
          fontFamily: "'Paytone One', sans-serif", fontSize: 20, fontWeight: 900,
          color: '#E5E7EB', margin: '0 0 8px', textAlign: 'center', letterSpacing: '-0.01em',
        }}>
          Acesso em Configuração
        </h1>

        {/* Subtítulo */}
        <p style={{
          fontSize: 13, color: '#8C96A3', textAlign: 'center', lineHeight: 1.6,
          margin: '0 0 28px', maxWidth: 320,
        }}>
          Conta autenticada com sucesso. Seu acesso aos canais do Kanban aguarda a
          finalização do vínculo por um <strong style={{ color: '#b6c2cf' }}>Administrador</strong>.
        </p>

        {/* E-mail */}
        <div style={{
          width: '100%', padding: '10px 14px', borderRadius: 10, marginBottom: 28,
          background: 'rgba(37,208,102,0.06)', border: '1px solid rgba(37,208,102,0.14)',
          fontSize: 12, color: '#25D066', textAlign: 'center', wordBreak: 'break-all',
        }}>
          {user}
        </div>

        {/* Instruções */}
        <div style={{
          width: '100%', padding: '14px 16px', borderRadius: 10, marginBottom: 28,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12, color: '#6B7685', lineHeight: 1.7,
        }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#8C96A3' }}>Próximos passos:</p>
          <p style={{ margin: 0 }}>① O administrador adicionará sua conta a um departamento</p>
          <p style={{ margin: 0 }}>② Após o vínculo, faça logout e entre novamente</p>
        </div>

        {/* Botão sair */}
        <button
          onClick={onLogout}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#8C96A3', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#b6c2cf' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#8C96A3' }}
        >
          Sair da conta
        </button>
      </div>

      <p style={{
        position: 'fixed', bottom: 20, left: 0, right: 0, textAlign: 'center',
        fontSize: 11, color: '#3B4754',
      }}>
        © {new Date().getFullYear()} chatPro
      </p>
    </div>
  )
}

/* ── Gate que bloqueia o app enquanto a org não está resolvida ── */
function OrgGate({ user, onLogout, children }: { user: string; onLogout: () => void; children: React.ReactNode }) {
  const { permissions, loading } = useOrg()

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1d2125' }}>
        <Icon name="Loader2" size={28} className="animate-spin" style={{ color: '#25D066' }} />
      </div>
    )
  }

  if (!permissions) {
    return <PendingAccessScreen user={user} onLogout={onLogout} />
  }

  return <>{children}</>
}

export default function App() {
  const [user, setUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<AppTab>('board')

  const [plannerTickets, setPlannerTickets] = useState<Ticket[]>([])
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    // Se o Supabase não está configurado, nem tenta verificar sessão
    if (!isSupabaseConfigured) {
      setLoading(false) // eslint-disable-line react-hooks/set-state-in-effect -- early return antes de qualquer async
      return
    }

    async function checkSession(email: string | null) {
      if (!email) { setUser(null); setLoading(false); return }
      logger.debug('Auth', 'checkSession chamado')

      // Bypass absoluto para super admins — antes de qualquer query
      if (isSuperAdmin(email)) {
        logger.debug('Auth', 'Super admin bypass aplicado')
        setUnauthorizedEmail(null)
        setUser(email)
        setLoading(false)
        return
      }

      const authorized = await checkAuthorizedUser(email)
      logger.debug('Auth', 'checkAuthorizedUser resultado', { authorized })
      if (!authorized) {
        setUnauthorizedEmail(email)
        await supabase.auth.signOut()
        setUser(null)
      } else {
        setUnauthorizedEmail(null)
        setUser(email)
      }
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email ?? session?.user?.user_metadata?.full_name ?? null
      logger.debug('Auth', 'getSession')
      checkSession(email)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? session?.user?.user_metadata?.full_name ?? null
      logger.debug('Auth', 'onAuthStateChange', { event: _event })
      if (_event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        return
      }
      checkSession(email)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Track user profile and update last_seen_at periodically
  useEffect(() => {
    if (!user) return
    upsertUserProfile(user)
    const interval = setInterval(() => updateLastSeen(user), 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  // Load tickets for planner view
  useEffect(() => {
    if (activeTab === 'planner') {
      fetchTickets().then(setPlannerTickets).catch(err => logger.error('App', 'Falha ao carregar tickets do planner', { error: String(err) }))
    }
  }, [activeTab])

  const handleLogin = (email: string) => {
    setUser(email)
    setUnauthorizedEmail(null)
    setSentryUser(email)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSentryUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-muted)' }} className="text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <ErrorBoundary onError={(error, info) => { logger.error('App', 'ErrorBoundary capturou erro', { error: String(error) }); captureException(error, { componentStack: info.componentStack }) }}>
          {recoveryMode ? (
            <ResetPasswordScreen onDone={() => { setRecoveryMode(false); setUser(null) }} />
          ) : !user ? (
            <Login onLogin={handleLogin} unauthorizedEmail={unauthorizedEmail} />
          ) : (
            <ErrorBoundary>
              <OrgProvider user={user!}>
                <OrgGate user={user!} onLogout={handleLogout}>
                  <NotificationProvider user={user!}>
                    <AnnouncementProvider>
                      <SearchProvider>
                        <AppContent
                          activeTab={activeTab}
                          setActiveTab={setActiveTab}
                          user={user!}
                          plannerTickets={plannerTickets}
                          openTicketId={openTicketId}
                          setOpenTicketId={setOpenTicketId}
                          onLogout={handleLogout}
                        />
                      </SearchProvider>
                    </AnnouncementProvider>
                  </NotificationProvider>
                </OrgGate>
              </OrgProvider>
            </ErrorBoundary>
          )}
        </ErrorBoundary>
      </MotionConfig>
    </ThemeProvider>
  )
}

/* ── Inner component that has access to NotificationContext ── */
interface AppContentProps {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
  user: string
  plannerTickets: Ticket[]
  openTicketId: string | null
  setOpenTicketId: (id: string | null) => void
  onLogout: () => void
}

function AppContent({ activeTab, setActiveTab, user, plannerTickets, openTicketId, setOpenTicketId, onLogout }: AppContentProps) {
  const { toastNotification, dismissToast } = useNotificationContext()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isAnimating = useRef(false)
  const sidebarWidth = 520

  const handleTabChange = useCallback((tab: AppTab) => {
    if (isAnimating.current) return

    // Clicking the active sidebar tab → close then go to board
    if (tab === activeTab && tab !== 'board') {
      const el = sidebarRef.current
      if (el) {
        isAnimating.current = true
        animate(el, { x: -el.offsetWidth, opacity: 0 }, { duration: 0.35, ease: 'easeIn' })
          .then(() => { isAnimating.current = false; setActiveTab('board') })
      } else {
        setActiveTab('board')
      }
      return
    }

    // Switching to a different sidebar or closing → just set
    if (tab === 'board' && activeTab !== 'board') {
      const el = sidebarRef.current
      if (el) {
        isAnimating.current = true
        animate(el, { x: -el.offsetWidth, opacity: 0 }, { duration: 0.35, ease: 'easeIn' })
          .then(() => { isAnimating.current = false; setActiveTab('board') })
        return
      }
    }

    setActiveTab(tab)
  }, [activeTab, setActiveTab])

  // Ao abrir Avisos, remove imediatamente o toast relacionado a aviso.
  useEffect(() => {
    if (activeTab === 'announcements' && toastNotification?.type === 'announcement') {
      dismissToast()
    }
  }, [activeTab, toastNotification, dismissToast])

  // Clique na notificação nativa do navegador pode solicitar abertura da aba correta.
  useEffect(() => {
    const onOpenTab = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: string }>).detail
      if (detail?.tab !== 'inbox' && detail?.tab !== 'announcements') return
      setActiveTab(detail.tab)
      if (detail.tab === 'announcements') dismissToast()
    }

    window.addEventListener('chatpro-open-tab', onOpenTab)
    return () => window.removeEventListener('chatpro-open-tab', onOpenTab)
  }, [setActiveTab, dismissToast])

  // Entrance animation when sidebar mounts (Framer Motion)
  useEffect(() => {
    const el = sidebarRef.current
    if (!el || activeTab === 'board') return

    // Animate sidebar slide-in
    el.style.transform = `translateX(${-el.offsetWidth}px)`
    el.style.opacity = '0'
    animate(el, { x: 0, opacity: 1 }, { duration: 0.45, ease: 'easeOut' })

    // Stagger-in children
    const children = el.querySelectorAll('[data-stagger-child]')
    if (children.length > 0) {
      children.forEach((child, i) => {
        const htmlChild = child as HTMLElement
        htmlChild.style.transform = 'translateY(12px)'
        htmlChild.style.opacity = '0'
        animate(htmlChild, { y: 0, opacity: 1 }, { duration: 0.35, ease: 'easeOut', delay: 0.15 + i * 0.06 })
      })
    }
  }, [activeTab])

  const showSidebar = activeTab !== 'board'
  const activeSidebar: SidebarTab | null = activeTab === 'board' ? null : activeTab
  const showBoardActions = activeTab === 'board'

  const dispatchAfterBoard = useCallback((eventName: string) => {
    if (activeTab !== 'board') {
      handleTabChange('board')
      // Aguarda KanbanBoard montar antes de despachar.
      setTimeout(() => window.dispatchEvent(new Event(eventName)), 60)
    } else {
      window.dispatchEvent(new Event(eventName))
    }
  }, [activeTab, handleTabChange])

  return (
    <div className="app-shell">
      <AppHeader
        activeSidebar={activeSidebar}
        onSidebarChange={(tab) => handleTabChange(tab ?? 'board')}
        user={user}
        showBoardActions={showBoardActions}
        onCreateTicket={() => dispatchAfterBoard('chatpro:open-add-ticket')}
        onOpenMyProfile={() => dispatchAfterBoard('chatpro:open-my-profile')}
        onOpenSettings={() => dispatchAfterBoard('chatpro:open-settings')}
        onOpenArchived={() => dispatchAfterBoard('chatpro:open-archived')}
        onLogout={onLogout}
      />

      <div className="app-layout">
        {showSidebar && (
          <div ref={sidebarRef} className="sidebar-panel" style={{ width: sidebarWidth, transition: 'width 0.3s ease' }}>
            <div className="sidebar-panel__content">
              <Suspense fallback={<SidebarSpinner />}>
                <ErrorBoundary>
                  {activeTab === 'inbox' && (
                    <InboxSidebar
                      user={user}
                      onClose={() => handleTabChange('board')}
                      onOpenTicket={(ticketId) => setOpenTicketId(ticketId)}
                    />
                  )}
                  {activeTab === 'planner' && (
                    <PlannerSidebar
                      tickets={plannerTickets}
                      onClose={() => handleTabChange('board')}
                      user={user}
                      onOpenTicket={(ticketId) => setOpenTicketId(ticketId)}
                    />
                  )}
                  {activeTab === 'announcements' && (
                    <AnnouncementsView
                      user={user}
                      onClose={() => handleTabChange('board')}
                    />
                  )}
                  {activeTab === 'links' && (
                    <LinksView
                      user={user}
                      onClose={() => handleTabChange('board')}
                    />
                  )}
                </ErrorBoundary>
              </Suspense>
            </div>
          </div>
        )}

        <div className="app-layout__main">
          <AnimatePresence mode="wait">
            <motion.div
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <Workspace
                user={user}
                openTicketId={openTicketId}
                setOpenTicketId={setOpenTicketId}
                clearOpenTicketId={() => setOpenTicketId(null)}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Toast de notificação on-screen ── */}
      <AnimatePresence>
        {toastNotification && (
          <NotificationToast
            notif={toastNotification}
            onDismiss={dismissToast}
            onClickOpen={() => {
              dismissToast()
              const targetTab: SidebarTab = toastNotification.type === 'announcement' ? 'announcements' : 'inbox'
              if (activeTab !== targetTab) handleTabChange(targetTab)
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Onboarding tour para novos usuários ── */}
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>

      {/* ── Popover de novidades para usuários existentes ── */}
      <Suspense fallback={null}>
        <WhatsNew />
      </Suspense>
    </div>
  )
}

/* ── Toast flutuante de notificação ── */
import type { Notification } from './lib/supabase'

const TOAST_TYPE_ICON: Record<string, React.ReactNode> = {
  mention:      <Icon name="AtSign" size={16} />,
  assignment:   <Icon name="UserPlus" size={16} />,
  comment:      <Icon name="MessageSquare" size={16} />,
  move:         <Icon name="ArrowRight" size={16} />,
  announcement: <Icon name="Megaphone" size={16} />,
}

const TOAST_TYPE_LABEL: Record<string, string> = {
  mention: 'Menção',
  assignment: 'Atribuição',
  comment: 'Comentário',
  move: 'Movido',
  announcement: 'Novo Aviso',
}

function NotificationToast({ notif, onDismiss, onClickOpen }: { notif: Notification; onDismiss: () => void; onClickOpen: () => void }) {
  const icon = TOAST_TYPE_ICON[notif.type] || <Icon name="Inbox" size={16} />
  const label = TOAST_TYPE_LABEL[notif.type] || 'Notificação'

  return (
    <motion.div
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{
        position: 'fixed', top: 20, right: 20, zIndex: 9999,
        width: 320, borderRadius: 12,
        background: '#22272B',
        border: '1px solid rgba(37,208,102,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(37,208,102,0.08)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      onClick={onClickOpen}
    >
      {/* Barra verde no topo */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #25D066, #24FF72)', borderRadius: '12px 12px 0 0' }} />

      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Ícone */}
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'rgba(37,208,102,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#25D066', flexShrink: 0,
        }}>
          {icon}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              color: '#25D066', fontFamily: "'Space Grotesk', sans-serif",
            }}>
              {label}
            </span>
            <span style={{ fontSize: 10, color: '#6B7280', fontFamily: "'Space Grotesk', sans-serif" }}>
              · {notif.sender_name}
            </span>
          </div>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 500, color: '#E5E7EB',
            fontFamily: "'Space Grotesk', sans-serif",
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {notif.ticket_title || notif.message}
          </p>
          {notif.message && notif.ticket_title && (
            <p style={{
              margin: '2px 0 0', fontSize: 11, color: '#8C96A3',
              fontFamily: "'Space Grotesk', sans-serif",
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {notif.message}
            </p>
          )}
        </div>

        {/* Fechar */}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none',
            background: 'transparent', color: '#6B7280', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#E5E7EB' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6B7280' }}
        >
          <Icon name="X" size={14} />
        </button>
      </div>
    </motion.div>
  )
}
