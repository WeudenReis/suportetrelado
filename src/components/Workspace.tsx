import { useState, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import KanbanBoard from './KanbanBoard'
import type { WorkView } from './workspace/ViewSwitcher'

const TableView = lazy(() => import('./views/TableView'))
const CalendarView = lazy(() => import('./views/CalendarView'))
const TimelineView = lazy(() => import('./views/TimelineView'))
const DashboardFullscreenView = lazy(() => import('./views/DashboardFullscreenView'))

interface WorkspaceProps {
  user: string
  openTicketId: string | null
  clearOpenTicketId: () => void
  setOpenTicketId: (id: string) => void
}

function ViewSpinner() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#596773' }}>
      <Loader2 size={22} className="animate-spin" />
    </div>
  )
}

export default function Workspace({ user, openTicketId, clearOpenTicketId, setOpenTicketId }: WorkspaceProps) {
  const [view, setView] = useState<WorkView>('board')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          {view === 'board' && (
            <KanbanBoard
              user={user}
              openTicketId={openTicketId}
              clearOpenTicketId={clearOpenTicketId}
              view={view}
              onChangeView={setView}
            />
          )}
          {view === 'table' && (
            <Suspense fallback={<ViewSpinner />}>
              <TableView
                user={user}
                openTicketId={openTicketId}
                onCloseTicket={clearOpenTicketId}
                onOpenTicket={setOpenTicketId}
                view={view}
                onChangeView={setView}
              />
            </Suspense>
          )}
          {view === 'calendar' && (
            <Suspense fallback={<ViewSpinner />}>
              <CalendarView
                user={user}
                openTicketId={openTicketId}
                onCloseTicket={clearOpenTicketId}
                onOpenTicket={setOpenTicketId}
                view={view}
                onChangeView={setView}
              />
            </Suspense>
          )}
          {view === 'timeline' && (
            <Suspense fallback={<ViewSpinner />}>
              <TimelineView
                user={user}
                openTicketId={openTicketId}
                onCloseTicket={clearOpenTicketId}
                onOpenTicket={setOpenTicketId}
                view={view}
                onChangeView={setView}
              />
            </Suspense>
          )}
          {view === 'dashboard' && (
            <Suspense fallback={<ViewSpinner />}>
              <DashboardFullscreenView
                user={user}
                openTicketId={openTicketId}
                onCloseTicket={clearOpenTicketId}
                onOpenTicket={setOpenTicketId}
                view={view}
                onChangeView={setView}
              />
            </Suspense>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
