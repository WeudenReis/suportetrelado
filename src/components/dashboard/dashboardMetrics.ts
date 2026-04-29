import type { Ticket } from '../../lib/supabase'

// ── Aging report ────────────────────────────────────────────
// Distribui tickets ABERTOS (nao concluidos, nao arquivados) em buckets de idade
// baseados em created_at. Util para identificar cards "esquecidos".

export interface AgingBucket {
  key: string
  label: string
  color: string
  /** Idade minima em horas (inclusive) */
  fromHours: number
  /** Idade maxima em horas (exclusive). null = infinito */
  toHours: number | null
  count: number
}

const AGING_BUCKET_DEFS: Omit<AgingBucket, 'count'>[] = [
  { key: 'fresh',  label: '< 24h',     color: '#4bce97', fromHours: 0,         toHours: 24       },
  { key: 'days',   label: '1-3 dias',  color: '#7dd87a', fromHours: 24,        toHours: 24 * 3   },
  { key: 'week',   label: '3-7 dias',  color: '#e2b203', fromHours: 24 * 3,    toHours: 24 * 7   },
  { key: 'two',    label: '1-2 sem',   color: '#f5a623', fromHours: 24 * 7,    toHours: 24 * 14  },
  { key: 'stale',  label: '> 2 sem',   color: '#ef5c48', fromHours: 24 * 14,   toHours: null     },
]

export function calcAging(tickets: Ticket[]): AgingBucket[] {
  const now = Date.now()
  const buckets: AgingBucket[] = AGING_BUCKET_DEFS.map(b => ({ ...b, count: 0 }))
  for (const t of tickets) {
    if (t.is_completed) continue
    const ageH = (now - new Date(t.created_at).getTime()) / 3_600_000
    const idx = buckets.findIndex(b => ageH >= b.fromHours && (b.toHours === null || ageH < b.toHours))
    if (idx >= 0) buckets[idx].count++
  }
  return buckets
}

// ── Heatmap de atividade (dia da semana x hora) ──────────────
// Conta tickets criados por (weekday, hora). Retorna matriz 7x24
// com weekday 0=Domingo .. 6=Sabado e hora 0..23.

export interface HeatmapData {
  /** matrix[weekday][hour] = count */
  matrix: number[][]
  /** Maior valor da matriz (para normalizar a escala de cor) */
  max: number
  /** Total de tickets considerados */
  total: number
}

export function calcCreationHeatmap(tickets: Ticket[]): HeatmapData {
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  let total = 0
  for (const t of tickets) {
    const d = new Date(t.created_at)
    const wd = d.getDay()
    const h = d.getHours()
    matrix[wd][h]++
    total++
  }
  let max = 0
  for (const row of matrix) for (const v of row) if (v > max) max = v
  return { matrix, max, total }
}

// ── Throughput semanal ─────────────────────────────────────
// Cards concluidos agrupados por semana (ISO-ish; usa segunda como inicio).

export interface ThroughputWeek {
  /** YYYY-MM-DD da segunda-feira da semana */
  weekStart: string
  /** Label curto: "DD/MM" */
  label: string
  /** Concluidos na semana */
  completed: number
  /** Criados na semana */
  created: number
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay() // 0=Dom .. 6=Sab
  const diff = (day === 0 ? -6 : 1 - day) // segue ate segunda
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() + diff)
  return x
}

export function calcWeeklyThroughput(tickets: Ticket[], weeks: number): ThroughputWeek[] {
  const buckets = new Map<string, ThroughputWeek>()
  const today = startOfWeek(new Date())
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    const key = d.toISOString().slice(0, 10)
    const label = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
    buckets.set(key, { weekStart: key, label, completed: 0, created: 0 })
  }
  for (const t of tickets) {
    const created = startOfWeek(new Date(t.created_at)).toISOString().slice(0, 10)
    const cb = buckets.get(created)
    if (cb) cb.created++
    if (t.is_completed) {
      const done = startOfWeek(new Date(t.updated_at)).toISOString().slice(0, 10)
      const db = buckets.get(done)
      if (db) db.completed++
    }
  }
  return Array.from(buckets.values())
}

// ── Comparacao periodo vs anterior ──────────────────────────
// Dado um cutoff (timestamp ISO de inicio do periodo atual), calcula
// o periodo anterior de mesma duracao e retorna deltas percentuais.

export interface PeriodKPIs {
  total: number
  high: number
  completed: number
  resolutionRate: number
  avgHours: number
}

function computeKPIs(tickets: Ticket[]): PeriodKPIs {
  const total = tickets.length
  const high = tickets.filter(t => t.priority === 'high').length
  const completed = tickets.filter(t => t.is_completed).length
  const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const resolved = tickets.filter(t => t.is_completed)
  const avgHours = resolved.length === 0
    ? 0
    : Math.round(
        resolved.reduce((s, t) => s + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()), 0)
        / resolved.length
        / 3_600_000,
      )
  return { total, high, completed, resolutionRate, avgHours }
}

export interface PeriodComparison {
  current: PeriodKPIs
  previous: PeriodKPIs
  /** Delta percentual de cada KPI (current vs previous). null = sem periodo anterior */
  delta: {
    total: number | null
    high: number | null
    completed: number | null
    resolutionRate: number | null
    avgHours: number | null
  }
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null
  return Math.round(((curr - prev) / prev) * 100)
}

/**
 * cutoff: ISO de inicio do periodo atual. Se null, usa o primeiro ticket como inicio
 * (e "periodo anterior" nao existe — retorna delta=null).
 * cutoffEnd: ISO de fim do periodo atual (default = agora).
 *
 * `allActiveTickets` deve conter TODOS os tickets validos (filtrados apenas por
 * is_archived/coluna valida), sem filtros de periodo. A funcao mesma fatia.
 */
// ── Top clientes ────────────────────────────────────────────
// Agrupa tickets por `cliente` (case-insensitive), retorna os N maiores
// em volume com contagem aberta/concluida e tempo medio de resolucao.

export interface ClientLoad {
  /** Nome original do cliente (preserva acentuacao/case do primeiro ocorrencia) */
  cliente: string
  /** Total de tickets do cliente (no dataset passado) */
  count: number
  /** Tickets ainda abertos (nao-concluidos) */
  openCount: number
  /** Tickets concluidos */
  completedCount: number
  /** Tempo medio em horas para resolver (apenas resolvidos). 0 se nao houver */
  avgHours: number
}

export function calcTopClients(tickets: Ticket[], limit: number = 10): ClientLoad[] {
  const buckets = new Map<string, {
    display: string
    count: number
    openCount: number
    completedCount: number
    totalHours: number
    resolvedCount: number
  }>()
  for (const t of tickets) {
    const raw = (t.cliente || '').trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    let b = buckets.get(key)
    if (!b) {
      b = { display: raw, count: 0, openCount: 0, completedCount: 0, totalHours: 0, resolvedCount: 0 }
      buckets.set(key, b)
    }
    b.count++
    if (t.is_completed) {
      b.completedCount++
      const hours = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 3_600_000
      if (hours >= 0) {
        b.totalHours += hours
        b.resolvedCount++
      }
    } else {
      b.openCount++
    }
  }
  return Array.from(buckets.values())
    .map(b => ({
      cliente: b.display,
      count: b.count,
      openCount: b.openCount,
      completedCount: b.completedCount,
      avgHours: b.resolvedCount > 0 ? Math.round(b.totalHours / b.resolvedCount) : 0,
    }))
    .sort((a, b) => b.count - a.count || b.openCount - a.openCount)
    .slice(0, limit)
}

// ── Forecast de backlog ─────────────────────────────────────
// Estima quantos dias para zerar o backlog atual ao ritmo das ultimas N semanas.

export interface Forecast {
  /** Tickets abertos no momento (nao-concluidos) */
  openCount: number
  /** Velocidade media semanal (concluidos por semana, nas ultimas 4 semanas) */
  weeklyVelocity: number
  /** Dias estimados para zerar o backlog. null quando velocidade = 0 */
  daysToZero: number | null
}

export function calcForecast(openCount: number, throughputWeeks: ThroughputWeek[]): Forecast {
  const recent = throughputWeeks.slice(-4)
  const totalCompleted = recent.reduce((s, w) => s + w.completed, 0)
  const avgFloat = recent.length > 0 ? totalCompleted / recent.length : 0
  const weeklyVelocity = Math.round(avgFloat)
  const daysToZero = avgFloat > 0 ? Math.max(0, Math.round((openCount / avgFloat) * 7)) : null
  return { openCount, weeklyVelocity, daysToZero }
}

export function calcPeriodComparison(
  allActiveTickets: Ticket[],
  cutoff: string | null,
  cutoffEnd: string | null,
): PeriodComparison {
  if (!cutoff) {
    const current = computeKPIs(allActiveTickets)
    const empty: PeriodKPIs = { total: 0, high: 0, completed: 0, resolutionRate: 0, avgHours: 0 }
    return {
      current,
      previous: empty,
      delta: { total: null, high: null, completed: null, resolutionRate: null, avgHours: null },
    }
  }
  const startMs = new Date(cutoff).getTime()
  const endMs = cutoffEnd ? new Date(cutoffEnd).getTime() : Date.now()
  const duration = endMs - startMs
  const prevEnd = startMs
  const prevStart = startMs - duration

  const inRange = (ts: string, from: number, to: number) => {
    const t = new Date(ts).getTime()
    return t >= from && t <= to
  }

  const currentTickets = allActiveTickets.filter(t => inRange(t.created_at, startMs, endMs))
  const previousTickets = allActiveTickets.filter(t => inRange(t.created_at, prevStart, prevEnd))

  const current = computeKPIs(currentTickets)
  const previous = computeKPIs(previousTickets)

  return {
    current,
    previous,
    delta: {
      total: pct(current.total, previous.total),
      high: pct(current.high, previous.high),
      completed: pct(current.completed, previous.completed),
      resolutionRate: pct(current.resolutionRate, previous.resolutionRate),
      // Para tempo medio, MENOR e melhor — a inversao de sinal acontece no display
      avgHours: pct(current.avgHours, previous.avgHours),
    },
  }
}
