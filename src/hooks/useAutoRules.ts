/**
 * useAutoRules
 * Centraliza a lógica de "regras automáticas" que movia tickets entre colunas
 * com base em condições (prioridade, responsável, tempo ocioso, etc.)
 * Extraído de KanbanBoard.tsx para reduzir o tamanho do componente.
 */
import { useCallback } from 'react'
import { updateTicket } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { Ticket, TicketStatus } from '../lib/supabase'

export interface AutoRule {
  name: string
  enabled: boolean
  condition: 'priority_high' | 'priority_medium' | 'priority_low' | 'no_assignee' | 'overdue_12h' | 'overdue_24h'
  targetColumn: string
}

const STORAGE_KEY = 'chatpro-auto-rules'

export function loadAutoRules(): AutoRule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as AutoRule[]
  } catch {
    return []
  }
}

function matchesRule(ticket: Ticket, rule: AutoRule): boolean {
  switch (rule.condition) {
    case 'priority_high':   return ticket.priority === 'high'
    case 'priority_medium': return ticket.priority === 'medium'
    case 'priority_low':    return ticket.priority === 'low'
    case 'no_assignee':     return !ticket.assignee
    case 'overdue_12h': {
      const hoursIdle = (Date.now() - new Date(ticket.updated_at).getTime()) / 3_600_000
      return hoursIdle >= 12 && ticket.status !== 'resolved'
    }
    case 'overdue_24h': {
      const hoursIdle = (Date.now() - new Date(ticket.updated_at).getTime()) / 3_600_000
      return hoursIdle >= 24 && ticket.status !== 'resolved'
    }
    default: return false
  }
}

export function useAutoRules() {
  /**
   * Aplica todas as regras ativas a um ticket individual.
   * Retorna o ticket com o status possivelmente alterado.
   */
  const applyRulesToTicket = useCallback((ticket: Ticket): Ticket => {
    if (ticket.is_archived) return ticket
    const rules = loadAutoRules().filter(r => r.enabled)
    for (const rule of rules) {
      if (ticket.status === rule.targetColumn) continue
      if (matchesRule(ticket, rule)) {
        updateTicket(ticket.id, { status: rule.targetColumn as TicketStatus })
          .catch(err => logger.error('useAutoRules', 'Falha ao aplicar regra', { error: String(err) }))
        return { ...ticket, status: rule.targetColumn as TicketStatus }
      }
    }
    return ticket
  }, [])

  /**
   * Aplica as regras a um array de tickets e retorna as atualizações
   * necessárias. Não persiste — o chamador decide quando persistir.
   */
  const applyRulesToBatch = useCallback((tickets: Ticket[]): {
    processed: Ticket[]
    updates: { id: string; newStatus: string; ruleName: string }[]
  } => {
    const rules = loadAutoRules().filter(r => r.enabled)
    const updates: { id: string; newStatus: string; ruleName: string }[] = []

    if (rules.length === 0) return { processed: tickets, updates }

    const processed = tickets.map(ticket => {
      if (ticket.is_archived) return ticket
      for (const rule of rules) {
        if (ticket.status === rule.targetColumn) continue
        if (matchesRule(ticket, rule)) {
          updates.push({ id: ticket.id, newStatus: rule.targetColumn, ruleName: rule.name })
          return { ...ticket, status: rule.targetColumn as TicketStatus }
        }
      }
      return ticket
    })

    return { processed, updates }
  }, [])

  return { applyRulesToTicket, applyRulesToBatch, loadAutoRules }
}
