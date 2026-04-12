import type { TicketStatus } from './supabase'

/**
 * Colunas canônicas do Kanban (status fixos do produto).
 * Colunas customizadas vêm de `board_columns` via `fetchBoardColumns()`.
 */
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
