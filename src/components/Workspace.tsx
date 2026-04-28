import { useState, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import KanbanBoard from './KanbanBoard'
import ViewSwitcher, { type WorkView } from './workspace/ViewSwitcher'

const TableView = lazy(() => import('./views/TableView'))

interface WorkspaceProps {
  user: string
  onLogout: () => void
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

export default function Workspace({ user, onLogout, openTicketId, clearOpenTicketId, setOpenTicketId }: WorkspaceProps) {
  const [view, setView] = useState<WorkView>('board')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ViewSwitcher active={view} onChange={setView} />

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
              onLogout={onLogout}
              openTicketId={openTicketId}
              clearOpenTicketId={clearOpenTicketId}
            />
          )}
          {view === 'table' && (
            <Suspense fallback={<ViewSpinner />}>
              <TableView
                user={user}
                openTicketId={openTicketId}
                onCloseTicket={clearOpenTicketId}
                onOpenTicket={setOpenTicketId}
              />
            </Suspense>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
