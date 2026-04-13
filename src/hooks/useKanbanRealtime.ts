import { useEffect, useRef, useState } from 'react'
import { supabase, fetchAttachmentCounts } from '../lib/supabase'
import type { Ticket } from '../lib/supabase'

interface UseKanbanRealtimeOptions {
  departmentId: string | null
  applyRulesToTicket: (ticket: Ticket) => Ticket
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>
  loadTickets: () => Promise<void>
  setLoading: (loading: boolean) => void
}

/**
 * Mantém a lista de tickets sincronizada via Supabase realtime.
 * Aplica debounce de 300 ms para evitar reconexão-storm ao alternar departamentos.
 *
 * Retorna `isConnected` (status do canal) e `channelRef` (caso o caller precise inspecionar).
 */
export function useKanbanRealtime({
  departmentId,
  applyRulesToTicket,
  setTickets,
  loadTickets,
  setLoading,
}: UseKanbanRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const timer = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      loadTickets().finally(() => setLoading(false))

      const realtimeFilter = departmentId ? { filter: `department_id=eq.${departmentId}` } : {}
      channel = supabase
        .channel(`tickets-realtime-${departmentId || 'all'}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets', ...realtimeFilter }, payload => {
          setTickets(prev => {
            if (prev.some(t => t.id === (payload.new as Ticket).id)) return prev
            const newTicket = applyRulesToTicket({ ...(payload.new as Ticket), attachment_count: 0 } as Ticket)
            return [...prev, newTicket]
          })
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', ...realtimeFilter }, payload => {
          setTickets(prev => prev.map(t => {
            if (t.id !== (payload.new as Ticket).id) return t
            return { ...(payload.new as Ticket), attachment_count: t.attachment_count || 0 }
          }))
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets', ...realtimeFilter }, payload => {
          setTickets(prev => prev.filter(t => t.id !== (payload.old as Record<string, string>).id))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments', ...realtimeFilter }, () => {
          fetchAttachmentCounts(departmentId ?? undefined).then(counts => {
            setTickets(prev => prev.map(t => ({ ...t, attachment_count: counts[t.id] || 0 })))
          })
        })
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED')
        })

      channelRef.current = channel
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [loadTickets, departmentId, applyRulesToTicket, setTickets, setLoading])

  return { isConnected, channelRef }
}
