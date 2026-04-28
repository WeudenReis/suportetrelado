import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase, fetchTickets, fetchUserProfiles, type Ticket, type UserProfile } from '../../lib/supabase'
import { fetchBoardColumns, type BoardColumn } from '../../lib/boardColumns'
import { logger } from '../../lib/logger'
import { useOrg } from '../../lib/orgContext'
import DashboardExpanded from '../DashboardExpanded'

interface DashboardFullscreenViewProps {
  user: string
  openTicketId?: string | null
  onCloseTicket?: () => void
  onOpenTicket?: (id: string) => void
}

/** Visualização Dashboard fullscreen do Workspace.
 *  Self-fetcha tickets/profiles/columns e renderiza DashboardExpanded inline (embedded). */
export default function DashboardFullscreenView({ user }: DashboardFullscreenViewProps) {
  const { departmentId } = useOrg()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [t, p, c] = await Promise.all([
        fetchTickets({ departmentId: departmentId ?? undefined }),
        fetchUserProfiles(),
        fetchBoardColumns(),
      ])
      setTickets(t)
      setProfiles(p)
      setColumns(c)
    } catch (err) {
      logger.error('DashboardFullscreen', 'Falha ao carregar dados', { error: String(err) })
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => { loadData() }, [loadData])

  // Realtime: mantém tickets sincronizados com mudanças no board
  useEffect(() => {
    const filter = departmentId ? { filter: `department_id=eq.${departmentId}` } : {}
    const channel = supabase
      .channel(`dashboard-fs-tickets-${departmentId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', ...filter }, () => {
        fetchTickets({ departmentId: departmentId ?? undefined })
          .then(setTickets)
          .catch(err => logger.error('DashboardFullscreen', 'Falha ao atualizar tickets', { error: String(err) }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [departmentId])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#596773', background: '#1d2125' }}>
        <Loader2 size={22} className="animate-spin" />
      </div>
    )
  }

  return (
    <DashboardExpanded
      tickets={tickets}
      profiles={profiles}
      columns={columns}
      user={user}
      embedded
    />
  )
}
