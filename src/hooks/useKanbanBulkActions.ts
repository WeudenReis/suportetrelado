import { useCallback, useState } from 'react'
import { supabase, updateTicket } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { Ticket, TicketStatus } from '../lib/supabase'

interface UseKanbanBulkActionsOptions {
  showToast: (msg: string, type: 'ok' | 'err') => void
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>
}

/**
 * Encapsula seleção múltipla de cards: estado do modo bulk, conjunto selecionado,
 * e operações em lote (mover, arquivar) com optimistic UI.
 */
export function useKanbanBulkActions({ showToast, setTickets }: UseKanbanBulkActionsOptions) {
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())

  const toggleBulkSelect = useCallback((id: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkMove = useCallback(async (targetColumn: string) => {
    if (selectedCardIds.size === 0) return
    const ids = Array.from(selectedCardIds)
    setTickets(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: targetColumn as TicketStatus } : t))
    setSelectedCardIds(new Set())
    setBulkMode(false)
    showToast(`${ids.length} card(s) movido(s)`, 'ok')
    for (const id of ids) {
      await updateTicket(id, { status: targetColumn as TicketStatus })
        .catch(err => logger.error('KanbanBoard', 'Operação falhou', { error: String(err) }))
    }
  }, [selectedCardIds, showToast, setTickets])

  const handleBulkArchive = useCallback(async () => {
    if (selectedCardIds.size === 0) return
    const ids = Array.from(selectedCardIds)
    setTickets(prev => prev.filter(t => !ids.includes(t.id)))
    setSelectedCardIds(new Set())
    setBulkMode(false)
    showToast(`${ids.length} card(s) arquivado(s)`, 'ok')
    for (const id of ids) {
      await Promise.resolve(
        supabase.from('tickets').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id),
      ).catch(err => logger.error('KanbanBoard', 'Operação falhou', { error: String(err) }))
    }
  }, [selectedCardIds, showToast, setTickets])

  return {
    bulkMode, setBulkMode,
    selectedCardIds, setSelectedCardIds,
    toggleBulkSelect,
    handleBulkMove,
    handleBulkArchive,
  }
}
