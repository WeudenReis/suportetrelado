import { useState, useCallback, useEffect, useRef } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase, fetchTickets, insertTicket, updateTicket, insertActivityLog } from '../lib/supabase'
import type { Ticket, TicketStatus } from '../lib/supabase'

export const COLUMNS: { id: TicketStatus; label: string; color: string; accent: string }[] = [
  { id: 'backlog',      label: 'Backlog',           color: 'rgba(87,157,255,0.08)',  accent: '#579dff' },
  { id: 'in_progress',  label: 'Em Progresso',      color: 'rgba(87,157,255,0.08)',  accent: '#579dff' },
  { id: 'waiting_devs', label: 'Aguardando Devs',   color: 'rgba(245,166,35,0.08)',  accent: '#f5a623' },
  { id: 'resolved',     label: 'Resolvido',         color: 'rgba(75,206,151,0.08)',  accent: '#4bce97' },
]

export interface CustomColumn {
  id: string
  label: string
  accent: string
}

export function useKanban(user: string) {
  const [tickets, setTickets]         = useState<Ticket[]>([])
  const [loading, setLoading]         = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([])
  const [columnOrder, setColumnOrder] = useState<string[]>(() => COLUMNS.map(c => c.id))
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ─── Toast ────────────────────────────────────────────────
  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Load tickets ─────────────────────────────────────────
  const loadTickets = useCallback(async () => {
    try {
      const data = await fetchTickets()
      setTickets(data)
    } catch (err) {
      console.error('Failed to load tickets:', err)
      showToast('Erro ao carregar tickets', 'err')
    }
  }, [])

  // ─── Realtime subscription ────────────────────────────────
  useEffect(() => {
    setLoading(true)
    loadTickets().finally(() => setLoading(false))

    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => {
          if (prev.some(t => t.id === (payload.new as Ticket).id)) return prev
          return [...prev, payload.new as Ticket]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => prev.map(t => t.id === (payload.new as Ticket).id ? (payload.new as Ticket) : t))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => prev.filter(t => t.id !== (payload.old as any).id))
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [loadTickets])

  // ─── Presence tracking ────────────────────────────────────
  useEffect(() => {
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: user } }
    })

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      setOnlineUsers(Object.keys(state))
    })

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ user, online_at: new Date().toISOString() })
      }
    })

    return () => { supabase.removeChannel(presenceChannel) }
  }, [user])

  // ─── Column order sync ────────────────────────────────────
  useEffect(() => {
    const nextIds = [
      ...COLUMNS.map(c => c.id),
      ...customColumns.map(c => c.id),
    ]
    setColumnOrder(prev => {
      const kept = prev.filter(id => nextIds.includes(id))
      const missing = nextIds.filter(id => !kept.includes(id))
      return [...kept, ...missing]
    })
  }, [customColumns])

  // ─── Derived data ─────────────────────────────────────────
  const allColumnsById = new Map(
    [...COLUMNS, ...customColumns.map(c => ({ ...c, color: 'rgba(255,255,255,0.05)' }))]
      .map(col => [col.id, col])
  )
  const allColumns = columnOrder
    .map(id => allColumnsById.get(id))
    .filter((col): col is NonNullable<typeof col> => Boolean(col))
  const columnIds = allColumns.map(col => col.id)

  const getColumnTickets = useCallback((status: string) => {
    let filtered = tickets.filter(t => t.status === status)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      )
    }
    return filtered
  }, [tickets, searchQuery])

  const staleCount = tickets.filter(
    t => Date.now() - new Date(t.updated_at).getTime() > 2 * 60 * 60 * 1000 && t.status !== 'resolved'
  ).length

  // ─── CRUD ─────────────────────────────────────────────────
  const addTicket = async (data: {
    title: string; description: string; priority: Ticket['priority'];
    status: TicketStatus; cliente: string; instancia: string
  }) => {
    if (!data.title.trim()) return
    const created = await insertTicket({
      title: data.title.trim(),
      description: data.description || '',
      status: data.status,
      priority: data.priority,
      cliente: data.cliente || '',
      instancia: data.instancia || '',
      assignee: user,
    })
    setTickets(prev => prev.some(t => t.id === created.id) ? prev : [...prev, created])
    showToast('Ticket criado!', 'ok')
    return created
  }

  const addInlineTicket = async (col: TicketStatus, title: string) => {
    if (!title.trim()) return
    const created = await insertTicket({
      title: title.trim(), description: '', status: col,
      priority: 'medium', assignee: user,
    })
    setTickets(prev => prev.some(t => t.id === created.id) ? prev : [...prev, created])
    return created
  }

  const handleTicketUpdate = (updated: Ticket) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  const handleTicketDelete = (id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id))
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTickets()
    setRefreshing(false)
  }

  // ─── DnD ──────────────────────────────────────────────────
  const moveTicket = async (
    activeId: string, overId: string, targetStatus: string
  ) => {
    const ticket = tickets.find(t => t.id === activeId)
    if (!ticket || ticket.status === targetStatus) return

    const fromLabel = COLUMNS.find(c => c.id === ticket.status)?.label || ticket.status
    const toLabel = COLUMNS.find(c => c.id === targetStatus)?.label || targetStatus

    // Optimistic update
    setTickets(prev => {
      const activeIndex = prev.findIndex(t => t.id === activeId)
      if (activeIndex < 0) return prev
      const next = [...prev]
      next[activeIndex] = { ...next[activeIndex], status: targetStatus as TicketStatus }
      const overIndex = next.findIndex(t => t.id === overId)
      if (overIndex >= 0) return arrayMove(next, activeIndex, overIndex)
      const withoutActive = next.filter(t => t.id !== activeId)
      const lastInTarget = withoutActive.reduce((idx, t, i) => (t.status === targetStatus ? i : idx), -1)
      const insertAt = lastInTarget >= 0 ? lastInTarget + 1 : withoutActive.length
      withoutActive.splice(insertAt, 0, next[activeIndex])
      return withoutActive
    })

    const canPersistStatus = COLUMNS.some(c => c.id === targetStatus)
    if (!canPersistStatus) {
      insertActivityLog(activeId, user, `moveu este cartão de ${fromLabel} para ${toLabel}`)
      return
    }

    try {
      await updateTicket(activeId, { status: targetStatus as TicketStatus })
      await insertActivityLog(activeId, user, `moveu este cartão de ${fromLabel} para ${toLabel}`)
    } catch {
      showToast('Erro ao mover ticket', 'err')
      loadTickets()
    }
  }

  const reorderColumns = (activeColId: string, overColId: string) => {
    const oldIndex = columnOrder.indexOf(activeColId)
    const newIndex = columnOrder.indexOf(overColId)
    if (oldIndex < 0 || newIndex < 0) return
    setColumnOrder(prev => arrayMove(prev, oldIndex, newIndex))
  }

  return {
    tickets, setTickets, loading, isConnected, refreshing,
    onlineUsers, searchQuery, setSearchQuery,
    customColumns, setCustomColumns, columnOrder,
    toast, showToast,
    allColumnsById, allColumns, columnIds,
    getColumnTickets, staleCount,
    addTicket, addInlineTicket, handleTicketUpdate, handleTicketDelete,
    handleRefresh, moveTicket, reorderColumns,
  }
}
