import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
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
  const [plannerCollapsed, setPlannerCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'inbox' | 'planner' | 'board'>('board')
  const [plannerTickets, setPlannerTickets] = useState<Ticket[]>([])
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  const [inboxCollapsed, setInboxCollapsed] = useState(false)
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

  const renderView = () => {
    return (
      <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="flex-1 flex flex-col min-h-0">
        <KanbanBoard user={user!} onLogout={handleLogout} openTicketId={openTicketId} />
      </motion.div>
    )
  }

  return (
    <ThemeProvider>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div className="app-layout">
          {activeTab === 'inbox' && (
            <InboxSidebar
              user={user!}
              collapsed={inboxCollapsed}
              onToggle={() => setInboxCollapsed(p => !p)}
              onOpenTicket={(ticketId) => {
                setOpenTicketId(ticketId)
              }}
            />
          )}
          {activeTab === 'planner' && (
            <PlannerSidebar tickets={plannerTickets} collapsed={plannerCollapsed} onToggle={() => setPlannerCollapsed(p => !p)} />
          )}
          <div className="app-layout__main">
            <AnimatePresence mode="wait">
              {renderView()}
            </AnimatePresence>
            <BottomNav active={activeTab} onChange={setActiveTab} />
          </div>
        </div>
      )}
    </ThemeProvider>
  )
}
