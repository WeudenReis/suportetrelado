import type { Ticket, UserProfile } from './supabase'

export type GroupByMode = 'none' | 'assignee' | 'priority' | 'cliente'

export interface TicketGroup {
  /** Chave estável usada para reconciliação no React */
  key: string
  /** Rótulo exibido no cabeçalho do grupo */
  label: string
  /** Cor opcional (avatar/dot) */
  color?: string
  tickets: Ticket[]
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABEL: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }
const PRIORITY_COLOR: Record<string, string> = { high: '#ef5c48', medium: '#e2b203', low: '#4bce97' }

const FALLBACK_AVATAR_COLORS = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']

function fallbackAvatarColor(name: string): string {
  if (!name) return '#454F59'
  return FALLBACK_AVATAR_COLORS[name.charCodeAt(0) % FALLBACK_AVATAR_COLORS.length]
}

/**
 * Agrupa uma lista plana de tickets por uma dimensão (assignee/priority/cliente).
 * Mantém a ordem original dos tickets dentro de cada grupo (estável).
 *
 * Para `assignee`, o agrupamento usa o PRIMEIRO responsável da lista
 * (split ',' do campo `assignee`), para evitar duplicar cards em vários grupos.
 */
export function groupTickets(
  tickets: Ticket[],
  mode: GroupByMode,
  members: UserProfile[],
): TicketGroup[] {
  if (mode === 'none') {
    return [{ key: 'all', label: '', tickets }]
  }

  const buckets = new Map<string, TicketGroup>()
  const ensureBucket = (key: string, label: string, color?: string) => {
    let b = buckets.get(key)
    if (!b) { b = { key, label, color, tickets: [] }; buckets.set(key, b) }
    return b
  }

  for (const t of tickets) {
    if (mode === 'assignee') {
      const raw = (t.assignee || '').split(',').map(s => s.trim()).filter(Boolean)[0] || ''
      if (!raw) {
        ensureBucket('__none__', 'Sem responsável', '#454F59').tickets.push(t)
      } else {
        const profile = members.find(m =>
          m.email === raw ||
          m.name === raw ||
          m.email.split('@')[0].toLowerCase() === raw.toLowerCase(),
        )
        const key = profile?.email ?? raw.toLowerCase()
        const label = profile?.name || (raw.includes('@') ? raw.split('@')[0] : raw)
        const color = profile?.avatar_color || fallbackAvatarColor(label)
        ensureBucket(key, label, color).tickets.push(t)
      }
    } else if (mode === 'priority') {
      const key = t.priority || 'medium'
      ensureBucket(key, PRIORITY_LABEL[key] || key, PRIORITY_COLOR[key]).tickets.push(t)
    } else if (mode === 'cliente') {
      const raw = (t.cliente || '').trim()
      if (!raw) ensureBucket('__none__', 'Sem cliente', '#454F59').tickets.push(t)
      else ensureBucket(raw.toLowerCase(), raw, '#579dff').tickets.push(t)
    }
  }

  const groups = Array.from(buckets.values())

  if (mode === 'priority') {
    groups.sort((a, b) => (PRIORITY_ORDER[a.key] ?? 9) - (PRIORITY_ORDER[b.key] ?? 9))
  } else {
    // "Sem ..." sempre por último
    groups.sort((a, b) => {
      if (a.key === '__none__') return 1
      if (b.key === '__none__') return -1
      return a.label.localeCompare(b.label)
    })
  }

  return groups
}
