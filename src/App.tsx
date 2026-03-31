import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CalendarDays } from 'lucide-react'
import gsap from 'gsap'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import { NotificationProvider, useNotificationContext } from './components/NotificationContext'
import Login from './components/Login'
import KanbanBoard from './components/KanbanBoard'
import InboxSidebar from './components/InboxView'
import PlannerView from './components/PlannerView'
import PlannerSidebar from './components/PlannerSidebar'
import BottomNav from './components/BottomNav'
import { fetchTickets, upsertUserProfile, updateLastSeen } from './lib/supabase'
import type { Ticket } from './lib/supabase'

export default function App() {
  const [user, setUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'planner' | 'board'>('board')
  const [plannerTickets, setPlannerTickets] = useState<Ticket[]>([])
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user?.email ?? session?.user?.user_metadata?.full_name ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user?.email ?? session?.user?.user_metadata?.full_name ?? null)
      setLoading(false)
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
        <Login onLogin={handleLogin} />
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
  activeTab: 'inbox' | 'planner' | 'board'
  setActiveTab: (tab: 'inbox' | 'planner' | 'board') => void
  user: string
  plannerTickets: Ticket[]
  openTicketId: string | null
  setOpenTicketId: (id: string | null) => void
  onLogout: () => void
}

function AppContent({ activeTab, setActiveTab, user, plannerTickets, openTicketId, setOpenTicketId, onLogout }: AppContentProps) {
  const { unreadCount } = useNotificationContext()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isAnimating = useRef(false)

  const handleTabChange = useCallback((tab: 'inbox' | 'planner' | 'board') => {
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
        <div ref={sidebarRef} className="sidebar-panel">
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
    </div>
  )
}
