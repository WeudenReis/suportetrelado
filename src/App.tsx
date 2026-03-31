import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CalendarDays } from 'lucide-react'
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
  const showNav = activeTab !== 'board'

  const handleNavClick = (tab: 'inbox' | 'planner') => {
    if (activeTab === tab) {
      setActiveTab('board')
    } else {
      setActiveTab(tab)
    }
  }

  return (
    <div className="app-layout">
      {/* ── Sidebar Nav Strip ── */}
      {showNav && (
        <div className="sidebar-nav-strip">
          <button
            onClick={() => handleNavClick('inbox')}
            className={`sidebar-nav-btn${activeTab === 'inbox' ? ' sidebar-nav-btn--active' : ''}`}
            title="Caixa de Entrada"
            type="button"
          >
            <Inbox size={18} />
            {unreadCount > 0 && (
              <span className="inbox-collapsed-badge inbox-badge-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleNavClick('planner')}
            className={`sidebar-nav-btn${activeTab === 'planner' ? ' sidebar-nav-btn--active' : ''}`}
            title="Planejador"
            type="button"
          >
            <CalendarDays size={18} />
          </button>
        </div>
      )}

      {/* ── Expanded Sidebar Panels ── */}
      {activeTab === 'inbox' && (
        <InboxSidebar
          user={user}
          onClose={() => setActiveTab('board')}
          onOpenTicket={(ticketId) => setOpenTicketId(ticketId)}
        />
      )}
      {activeTab === 'planner' && (
        <PlannerSidebar
          tickets={plannerTickets}
          onClose={() => setActiveTab('board')}
        />
      )}

      <div className="app-layout__main">
        <AnimatePresence mode="wait">
          <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col min-h-0">
            <KanbanBoard user={user} onLogout={onLogout} openTicketId={openTicketId} />
          </motion.div>
        </AnimatePresence>
        <BottomNav active={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  )
}
