import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CalendarDays, Megaphone, Link2, BarChart3, ChevronsRight, ChevronsLeft, X, AtSign, UserPlus, MessageSquare, ArrowRight } from 'lucide-react'
import gsap from 'gsap'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import { NotificationProvider, useNotificationContext } from './components/NotificationContext'
import Login from './components/Login'
import KanbanBoard from './components/KanbanBoard'
import InboxSidebar from './components/InboxView'
import PlannerView from './components/PlannerView'
import PlannerSidebar from './components/PlannerSidebar'
import AnnouncementsView from './components/AnnouncementsView'
import LinksView from './components/LinksView'
import DashboardView from './components/DashboardView'
import BottomNav from './components/BottomNav'
import { fetchTickets, upsertUserProfile, updateLastSeen, checkAuthorizedUser } from './lib/supabase'
import type { Ticket } from './lib/supabase'

export default function App() {
  const [user, setUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'planner' | 'board' | 'announcements' | 'links' | 'dashboard'>('board')
  const [plannerTickets, setPlannerTickets] = useState<Ticket[]>([])
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession(email: string | null) {
      if (!email) { setUser(null); setLoading(false); return }
      const authorized = await checkAuthorizedUser(email)
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
      checkSession(email)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? session?.user?.user_metadata?.full_name ?? null
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
      fetchTickets().then(setPlannerTickets).catch(console.error)
    }
  }, [activeTab])

  const handleLogin = (email: string) => {
    setUser(email)
    setUnauthorizedEmail(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
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
      {!user ? (
        <Login onLogin={handleLogin} unauthorizedEmail={unauthorizedEmail} />
      ) : (
        <NotificationProvider user={user!}>
          <AppContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            user={user!}
            plannerTickets={plannerTickets}
            openTicketId={openTicketId}
            setOpenTicketId={setOpenTicketId}
            onLogout={handleLogout}
          />
        </NotificationProvider>
      )}
    </ThemeProvider>
  )
}

/* ── Inner component that has access to NotificationContext ── */
interface AppContentProps {
  activeTab: 'inbox' | 'planner' | 'board' | 'announcements' | 'links' | 'dashboard'
  setActiveTab: (tab: 'inbox' | 'planner' | 'board' | 'announcements' | 'links' | 'dashboard') => void
  user: string
  plannerTickets: Ticket[]
  openTicketId: string | null
  setOpenTicketId: (id: string | null) => void
  onLogout: () => void
}

function AppContent({ activeTab, setActiveTab, user, plannerTickets, openTicketId, setOpenTicketId, onLogout }: AppContentProps) {
  const { unreadCount, toastNotification, dismissToast } = useNotificationContext()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isAnimating = useRef(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const sidebarWidth = sidebarExpanded ? 520 : 340

  const handleTabChange = useCallback((tab: 'inbox' | 'planner' | 'board' | 'announcements' | 'links' | 'dashboard') => {
    if (isAnimating.current) return

    // Clicking the active sidebar tab → close with GSAP then go to board
    if (tab === activeTab && tab !== 'board') {
      const el = sidebarRef.current
      if (el) {
        isAnimating.current = true
        gsap.to(el, {
          x: -el.offsetWidth,
          opacity: 0,
          duration: 0.35,
          ease: 'power3.in',
          onComplete: () => {
            isAnimating.current = false
            setActiveTab('board')
          },
        })
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
        gsap.to(el, {
          x: -el.offsetWidth,
          opacity: 0,
          duration: 0.35,
          ease: 'power3.in',
          onComplete: () => {
            isAnimating.current = false
            setActiveTab('board')
          },
        })
        return
      }
    }

    setActiveTab(tab)
  }, [activeTab, setActiveTab])

  // GSAP entrance animation when sidebar mounts
  useEffect(() => {
    const el = sidebarRef.current
    if (!el || activeTab === 'board') return

    gsap.set(el, { x: -el.offsetWidth, opacity: 0 })
    gsap.to(el, {
      x: 0,
      opacity: 1,
      duration: 0.45,
      ease: 'power3.out',
    })

    // Stagger-in children of the sidebar content
    const children = el.querySelectorAll('[data-gsap-child]')
    if (children.length > 0) {
      gsap.fromTo(children,
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.06, ease: 'power2.out', delay: 0.15 }
      )
    }
  }, [activeTab])

  const showSidebar = activeTab !== 'board'

  return (
    <div className="app-layout">
      {/* ── Sidebar Panel (icons inside) ── */}
      {showSidebar && (
        <div ref={sidebarRef} className="sidebar-panel" style={{ width: sidebarWidth, transition: 'width 0.3s ease' }}>
          {/* ▸ Nav icons row */}
          <div className="sidebar-panel__nav">
            <button
              onClick={() => handleTabChange('inbox')}
              className={`sidebar-nav-btn${activeTab === 'inbox' ? ' sidebar-nav-btn--active' : ''}`}
              title="Caixa de Entrada"
              type="button"
            >
              <Inbox size={17} />
              {unreadCount > 0 && (
                <span className="sidebar-nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('planner')}
              className={`sidebar-nav-btn${activeTab === 'planner' ? ' sidebar-nav-btn--active' : ''}`}
              title="Planejador"
              type="button"
            >
              <CalendarDays size={17} />
            </button>
            <button
              onClick={() => handleTabChange('announcements')}
              className={`sidebar-nav-btn${activeTab === 'announcements' ? ' sidebar-nav-btn--active' : ''}`}
              title="Avisos"
              type="button"
            >
              <Megaphone size={17} />
            </button>
            <button
              onClick={() => handleTabChange('links')}
              className={`sidebar-nav-btn${activeTab === 'links' ? ' sidebar-nav-btn--active' : ''}`}
              title="Links Úteis"
              type="button"
            >
              <Link2 size={17} />
            </button>
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`sidebar-nav-btn${activeTab === 'dashboard' ? ' sidebar-nav-btn--active' : ''}`}
              title="Dashboard"
              type="button"
            >
              <BarChart3 size={17} />
            </button>

            {/* Spacer */}
            <span style={{ flex: 1 }} />

            {/* Expandir / Recolher */}
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="sidebar-nav-btn"
              title={sidebarExpanded ? 'Recolher painel' : 'Expandir painel'}
              type="button"
            >
              {sidebarExpanded ? <ChevronsLeft size={17} /> : <ChevronsRight size={17} />}
            </button>
          </div>

          {/* ▸ Sidebar content */}
          <div className="sidebar-panel__content">
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
            {activeTab === 'dashboard' && (
              <DashboardView
                user={user}
                onClose={() => handleTabChange('board')}
              />
            )}
          </div>
        </div>
      )}

      <div className="app-layout__main">
        <AnimatePresence mode="wait">
          <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col min-h-0">
            <KanbanBoard user={user} onLogout={onLogout} openTicketId={openTicketId} />
          </motion.div>
        </AnimatePresence>
        <BottomNav active={activeTab} onChange={handleTabChange} />
      </div>

      {/* ── Toast de notificação on-screen ── */}
      <AnimatePresence>
        {toastNotification && (
          <NotificationToast notif={toastNotification} onDismiss={dismissToast} onClickOpen={() => { dismissToast(); handleTabChange('inbox') }} />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Toast flutuante de notificação ── */
import type { Notification } from './lib/supabase'

const TOAST_TYPE_ICON: Record<string, React.ReactNode> = {
  mention:      <AtSign size={16} />,
  assignment:   <UserPlus size={16} />,
  comment:      <MessageSquare size={16} />,
  move:         <ArrowRight size={16} />,
  announcement: <Megaphone size={16} />,
}

const TOAST_TYPE_LABEL: Record<string, string> = {
  mention: 'Menção',
  assignment: 'Atribuição',
  comment: 'Comentário',
  move: 'Movido',
  announcement: 'Novo Aviso',
}

function NotificationToast({ notif, onDismiss, onClickOpen }: { notif: Notification; onDismiss: () => void; onClickOpen: () => void }) {
  const icon = TOAST_TYPE_ICON[notif.type] || <Inbox size={16} />
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
          <X size={14} />
        </button>
      </div>
    </motion.div>
  )
}
