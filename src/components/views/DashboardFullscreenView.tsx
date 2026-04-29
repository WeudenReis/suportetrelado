import { useState, useEffect, useCallback } from 'react'
import { Icon } from '../../lib/icons'
import { supabase, fetchTickets, fetchUserProfiles, type Ticket, type UserProfile } from '../../lib/supabase'
import { fetchBoardColumns, type BoardColumn } from '../../lib/boardColumns'
import { logger } from '../../lib/logger'
import { useOrg } from '../../lib/orgContext'
import DashboardExpanded from '../DashboardExpanded'
import ViewSwitcher, { type WorkView } from '../workspace/ViewSwitcher'

interface DashboardFullscreenViewProps {
  user: string
  openTicketId?: string | null
  onCloseTicket?: () => void
  onOpenTicket?: (id: string) => void
  view: WorkView
  onChangeView: (view: WorkView) => void
}

/** Visualização Dashboard fullscreen do Workspace.
 *  Self-fetcha tickets/profiles/columns e renderiza DashboardExpanded inline (embedded). */
export default function DashboardFullscreenView({ user, view, onChangeView }: DashboardFullscreenViewProps) {
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#1d2125' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(34,39,43,0.55)',
        flexShrink: 0,
      }}>
        <ViewSwitcher active={view} onChange={onChangeView} />
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#596773' }}>
          <Icon name="Loader2" size={22} className="animate-spin" />
        </div>
      ) : (
        <DashboardExpanded
          tickets={tickets}
          profiles={profiles}
          columns={columns}
          user={user}
          embedded
        />
      )}
    </div>
  )
}
