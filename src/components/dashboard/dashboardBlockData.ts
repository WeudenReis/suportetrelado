import { parseTag } from '../../lib/tagUtils'
import { PRIORITY_C } from './dashboardConstants'
import type { Ticket, UserProfile, BoardLabel } from '../../lib/supabase'
import type { BoardColumn } from '../../lib/boardColumns'
import type { BlockDimension } from '../../lib/api/dashboardBlocks'

export interface ChartDataPoint {
  label: string
  value: number
  color: string
}

export interface DashboardBlockContext {
  tickets: Ticket[]
  columns: BoardColumn[]
  profiles: UserProfile[]
  boardLabels: BoardLabel[]
}

const PALETTE = [
  '#25D066', '#579dff', '#a259ff', '#e2b203', '#ef5c48',
  '#06b6d4', '#ec4899', '#f97316', '#4bce97', '#8b5cf6',
]

/** Converte tickets em pontos {label, value, color} de acordo com a dimensao. */
export function aggregateBlockData(
  dimension: BlockDimension,
  ctx: DashboardBlockContext,
): ChartDataPoint[] {
  const { tickets, columns, profiles, boardLabels } = ctx

  switch (dimension) {
    case 'column': {
      const counts = new Map<string, number>()
      for (const t of tickets) {
        counts.set(t.status, (counts.get(t.status) ?? 0) + 1)
      }
      return columns.map((c, i) => ({
        label: c.title,
        value: counts.get(c.id) ?? 0,
        color: c.dot_color || PALETTE[i % PALETTE.length],
      }))
    }

    case 'tag': {
      const counts = new Map<string, { value: number; color: string }>()
      for (const t of tickets) {
        for (const raw of t.tags ?? []) {
          const { name, color } = parseTag(raw)
          if (!name) continue
          const cur = counts.get(name)
          counts.set(name, { value: (cur?.value ?? 0) + 1, color: cur?.color ?? color })
        }
      }
      // Tambem inclui labels do board que nao foram aplicadas (zero)
      for (const lbl of boardLabels) {
        if (!counts.has(lbl.name)) {
          counts.set(lbl.name, { value: 0, color: lbl.color })
        }
      }
      return Array.from(counts.entries())
        .filter(([, v]) => v.value > 0)
        .sort((a, b) => b[1].value - a[1].value)
        .map(([label, v]) => ({ label, value: v.value, color: v.color }))
    }

    case 'assignee': {
      const counts = new Map<string, number>()
      const noAssignee = tickets.filter(t => !t.assignee || t.assignee.trim() === '').length
      for (const t of tickets) {
        if (!t.assignee) continue
        const members = t.assignee.split(',').map(s => s.trim()).filter(Boolean)
        for (const m of members) {
          const profile = profiles.find(p => p.email === m || p.name === m)
          const display = profile?.name || (m.includes('@') ? m.split('@')[0] : m)
          counts.set(display, (counts.get(display) ?? 0) + 1)
        }
      }
      const arr = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({
          label,
          value,
          color: profiles.find(p => p.name === label)?.avatar_color || PALETTE[i % PALETTE.length],
        }))
      if (noAssignee > 0) {
        arr.push({ label: 'Sem responsável', value: noAssignee, color: '#596773' })
      }
      return arr
    }

    case 'priority': {
      const order: Array<{ key: 'high' | 'medium' | 'low'; label: string }> = [
        { key: 'high', label: 'Alta' },
        { key: 'medium', label: 'Média' },
        { key: 'low', label: 'Baixa' },
      ]
      return order.map(({ key, label }) => ({
        label,
        value: tickets.filter(t => t.priority === key).length,
        color: PRIORITY_C[key],
      }))
    }

    case 'due_date': {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayMs = today.getTime()
      const day = 24 * 3600 * 1000

      const buckets = {
        overdue: 0,
        today: 0,
        soon: 0,
        later: 0,
        none: 0,
        completed: 0,
      }
      for (const t of tickets) {
        if (t.is_completed) {
          buckets.completed++
          continue
        }
        if (!t.due_date) {
          buckets.none++
          continue
        }
        const dueMs = new Date(t.due_date + 'T12:00:00').getTime()
        const diff = dueMs - todayMs
        if (diff < 0) buckets.overdue++
        else if (diff < day) buckets.today++
        else if (diff <= 7 * day) buckets.soon++
        else buckets.later++
      }

      return [
        { label: 'Concluído', value: buckets.completed, color: '#25D066' },
        { label: 'Em atraso', value: buckets.overdue, color: '#ef5c48' },
        { label: 'Hoje', value: buckets.today, color: '#e2b203' },
        { label: 'Em até 7 dias', value: buckets.soon, color: '#579dff' },
        { label: 'Mais de 7 dias', value: buckets.later, color: '#8b5cf6' },
        { label: 'Sem data', value: buckets.none, color: '#596773' },
      ]
    }
  }
}
