import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw, ZoomIn, ZoomOut, GanttChart, Inbox } from 'lucide-react'
import { fetchTickets, type Ticket } from '../../lib/supabase'
import { updateTicket } from '../../lib/api/tickets'
import { fetchBoardColumns, type BoardColumn } from '../../lib/boardColumns'
import { useOrg } from '../../lib/orgContext'
import { logger } from '../../lib/logger'

const CardDetailModal = lazy(() => import('../CardDetailModal'))

interface TimelineViewProps {
  user: string
  openTicketId: string | null
  onCloseTicket: () => void
  onOpenTicket: (id: string) => void
}

const FONT = "'Space Grotesk', sans-serif"
const SIDEBAR_WIDTH = 260
const ROW_HEIGHT = 38
const HEADER_HEIGHT = 52
const HANDLE_WIDTH = 6
const PRIO_COLORS: Record<string, string> = { high: '#ef5c48', medium: '#F5A623', low: '#25D066' }
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const DAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const ZOOM_LEVELS = [
  { id: 'compact', label: 'Compacto', dayWidth: 22 },
  { id: 'normal',  label: 'Normal',   dayWidth: 36 },
  { id: 'wide',    label: 'Amplo',    dayWidth: 56 },
] as const

type ZoomId = typeof ZOOM_LEVELS[number]['id']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseDateKey(key: string | null | undefined): Date | null {
  if (!key) return null
  const slice = key.slice(0, 10)
  const [y, m, d] = slice.split('-').map(n => parseInt(n, 10))
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / 86400000)
}

interface TicketSpan {
  ticket: Ticket
  start: Date
  end: Date
  startKey: string
  endKey: string
  daysSpan: number
}

interface DragState {
  mode: 'move' | 'resize-left' | 'resize-right'
  ticketId: string
  pointerId: number
  startX: number
  origStart: Date
  origEnd: Date
  preview: { startKey: string; endKey: string }
}

export default function TimelineView({ user, openTicketId, onCloseTicket, onOpenTicket }: TimelineViewProps) {
  const { departmentId } = useOrg()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [boardColumns, setBoardColumns] = useState<BoardColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [zoom, setZoom] = useState<ZoomId>('normal')
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const dayWidth = ZOOM_LEVELS.find(z => z.id === zoom)!.dayWidth
  const scrollerRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [t, cols] = await Promise.all([
        fetchTickets({ departmentId: departmentId ?? undefined }),
        fetchBoardColumns(departmentId ?? undefined),
      ])
      setTickets(t.filter(tk => !tk.is_archived))
      setBoardColumns(cols)
    } catch (err) {
      logger.error('TimelineView', 'Falha ao carregar dados', { error: String(err) })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [departmentId])

  useEffect(() => { loadData() }, [loadData])

  // Tickets com pelo menos uma data definida → vão para a Timeline
  const spans: TicketSpan[] = useMemo(() => {
    const list: TicketSpan[] = []
    for (const t of tickets) {
      const start = parseDateKey(t.start_date)
      const due = parseDateKey(t.due_date)
      if (!start && !due) continue
      const s = start ?? due!
      const e = due ?? start!
      // Garantir start <= end
      const realStart = s <= e ? s : e
      const realEnd = s <= e ? e : s
      list.push({
        ticket: t,
        start: realStart,
        end: realEnd,
        startKey: dateKey(realStart),
        endKey: dateKey(realEnd),
        daysSpan: diffDays(realStart, realEnd) + 1,
      })
    }
    list.sort((a, b) => a.start.getTime() - b.start.getTime() || a.ticket.title.localeCompare(b.ticket.title, 'pt-BR'))
    return list
  }, [tickets])

  // Range visível: do ticket mais antigo - 3 dias até o mais futuro + 14 dias.
  // Sem tickets, mostra ±21 dias ao redor de hoje.
  const range = useMemo(() => {
    if (spans.length === 0) {
      return { start: addDays(today, -7), end: addDays(today, 30) }
    }
    let minStart = spans[0].start
    let maxEnd = spans[0].end
    spans.forEach(s => {
      if (s.start < minStart) minStart = s.start
      if (s.end > maxEnd) maxEnd = s.end
    })
    const rangeStart = addDays(minStart < today ? minStart : today, -3)
    const rangeEnd = addDays(maxEnd > today ? maxEnd : today, 14)
    return { start: rangeStart, end: rangeEnd }
  }, [spans, today])

  const totalDays = useMemo(() => diffDays(range.start, range.end) + 1, [range])
  const totalWidth = totalDays * dayWidth

  // Marca de meses no header (combinação dia+mês)
  const dayCells = useMemo(() => {
    const arr: { date: Date; key: string; isToday: boolean; isWeekend: boolean }[] = []
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(range.start, i)
      arr.push({
        date: d,
        key: dateKey(d),
        isToday: d.getTime() === today.getTime(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      })
    }
    return arr
  }, [range, totalDays, today])

  // Agrupa segmentos contínuos do mesmo mês para o header superior
  const monthSegments = useMemo(() => {
    const segs: { label: string; start: number; length: number }[] = []
    let curMonth = -1
    let curYear = -1
    let curStart = 0
    dayCells.forEach((cell, idx) => {
      const m = cell.date.getMonth()
      const y = cell.date.getFullYear()
      if (m !== curMonth || y !== curYear) {
        if (curMonth !== -1) {
          segs.push({ label: `${MONTHS_PT[curMonth]} ${curYear}`, start: curStart, length: idx - curStart })
        }
        curMonth = m
        curYear = y
        curStart = idx
      }
    })
    if (curMonth !== -1) {
      segs.push({ label: `${MONTHS_PT[curMonth]} ${curYear}`, start: curStart, length: dayCells.length - curStart })
    }
    return segs
  }, [dayCells])

  // Auto-scroll para deixar "hoje" centralizado no primeiro load
  useEffect(() => {
    if (loading || !scrollerRef.current) return
    const todayOffset = diffDays(range.start, today) * dayWidth
    const viewport = scrollerRef.current.clientWidth - SIDEBAR_WIDTH
    scrollerRef.current.scrollLeft = Math.max(0, todayOffset - viewport / 3)
  }, [loading, range.start, today, dayWidth])

  // ── Drag & resize ────────────────────────────────────────────
  const beginDrag = (e: React.PointerEvent, span: TicketSpan, mode: DragState['mode']) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const next: DragState = {
      mode,
      ticketId: span.ticket.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      origStart: span.start,
      origEnd: span.end,
      preview: { startKey: span.startKey, endKey: span.endKey },
    }
    dragRef.current = next
    setDrag(next)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const cur = dragRef.current
    if (!cur || cur.pointerId !== e.pointerId) return
    const deltaPx = e.clientX - cur.startX
    const deltaDays = Math.round(deltaPx / dayWidth)
    let newStart = cur.origStart
    let newEnd = cur.origEnd
    if (cur.mode === 'move') {
      newStart = addDays(cur.origStart, deltaDays)
      newEnd = addDays(cur.origEnd, deltaDays)
    } else if (cur.mode === 'resize-left') {
      newStart = addDays(cur.origStart, deltaDays)
      if (newStart > cur.origEnd) newStart = cur.origEnd
    } else if (cur.mode === 'resize-right') {
      newEnd = addDays(cur.origEnd, deltaDays)
      if (newEnd < cur.origStart) newEnd = cur.origStart
    }
    const preview = { startKey: dateKey(newStart), endKey: dateKey(newEnd) }
    if (preview.startKey === cur.preview.startKey && preview.endKey === cur.preview.endKey) return
    cur.preview = preview
    setDrag({ ...cur })
  }

  const handlePointerUp = async (e: React.PointerEvent) => {
    const cur = dragRef.current
    if (!cur || cur.pointerId !== e.pointerId) return
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    dragRef.current = null
    const ticketId = cur.ticketId
    const { startKey, endKey } = cur.preview
    setDrag(null)

    const original = tickets.find(t => t.id === ticketId)
    if (!original) return
    const origStart = original.start_date ?? null
    const origEnd = original.due_date ?? null

    const newStart = startKey
    const newEnd = endKey

    if ((origStart ?? null) === newStart && (origEnd ?? null) === newEnd) return

    setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, start_date: newStart, due_date: newEnd } : t)))
    try {
      await updateTicket(ticketId, { start_date: newStart, due_date: newEnd })
    } catch (err) {
      logger.error('TimelineView', 'Falha ao salvar datas', { error: String(err), ticketId })
      setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, start_date: origStart, due_date: origEnd } : t)))
    }
  }

  const handleTicketUpdate = (updated: Ticket) => {
    setTickets(prev => prev.map(t => (t.id === updated.id ? { ...updated, attachment_count: t.attachment_count } : t)))
  }
  const handleTicketDelete = (id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id))
    onCloseTicket()
  }
  const openTicket = openTicketId ? tickets.find(t => t.id === openTicketId) : null

  const todayOffset = diffDays(range.start, today) * dayWidth

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#1d2125', overflow: 'hidden' }}>
      {/* TOOLBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(34,39,43,0.55)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(37,208,102,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GanttChart size={17} style={{ color: '#25D066' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#E5E7EB', margin: 0, fontFamily: "'Paytone One', sans-serif" }}>
              Cronograma
            </h2>
            <p style={{ fontSize: 11, color: '#596773', margin: 0, fontFamily: FONT }}>
              {spans.length} cartão{spans.length === 1 ? '' : 'es'} agendado{spans.length === 1 ? '' : 's'} · arraste para reagendar
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            padding: 2, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
          }}>
            {ZOOM_LEVELS.map(z => (
              <button
                key={z.id}
                onClick={() => setZoom(z.id)}
                title={z.label}
                style={{
                  padding: '5px 10px', borderRadius: 6, border: 'none',
                  background: zoom === z.id ? 'rgba(37,208,102,0.18)' : 'transparent',
                  color: zoom === z.id ? '#25D066' : '#8C96A3',
                  fontSize: 11, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {z.label}
              </button>
            ))}
          </div>

          <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

          <button
            onClick={() => setZoom(z => z === 'compact' ? 'compact' : z === 'normal' ? 'compact' : 'normal')}
            disabled={zoom === 'compact'}
            title="Diminuir zoom"
            style={{ ...iconBtnStyle, opacity: zoom === 'compact' ? 0.4 : 1 }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom(z => z === 'wide' ? 'wide' : z === 'normal' ? 'wide' : 'normal')}
            disabled={zoom === 'wide'}
            title="Aumentar zoom"
            style={{ ...iconBtnStyle, opacity: zoom === 'wide' ? 0.4 : 1 }}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Atualizar"
            style={{ ...iconBtnStyle, opacity: refreshing ? 0.5 : 1, cursor: refreshing ? 'wait' : 'pointer' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#596773' }}>
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : spans.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#596773', gap: 10 }}>
          <Inbox size={28} />
          <p style={{ fontSize: 13, fontFamily: FONT, margin: 0 }}>
            Nenhum cartão com datas agendadas.
          </p>
          <p style={{ fontSize: 11, fontFamily: FONT, margin: 0, color: '#3B4754' }}>
            Defina <strong style={{ color: '#8C96A3' }}>data de início</strong> e/ou <strong style={{ color: '#8C96A3' }}>vencimento</strong> em um cartão para vê-lo aqui.
          </p>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          style={{
            flex: 1, overflow: 'auto', minHeight: 0,
            position: 'relative',
            background: '#1d2125',
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: `${SIDEBAR_WIDTH}px ${totalWidth}px`,
            minWidth: SIDEBAR_WIDTH + totalWidth,
          }}>
            {/* SIDEBAR HEADER (sticky) */}
            <div style={{
              position: 'sticky', top: 0, left: 0, zIndex: 4,
              height: HEADER_HEIGHT,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(34,39,43,0.95)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center',
              padding: '0 16px',
              fontSize: 10, fontWeight: 700, color: '#8C96A3',
              fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Cartão
            </div>

            {/* TIME HEADER (sticky top) */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 3,
              height: HEADER_HEIGHT,
              background: 'rgba(34,39,43,0.95)',
              backdropFilter: 'blur(8px)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Linha de meses */}
              <div style={{ position: 'relative', height: 22, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {monthSegments.map(seg => (
                  <div
                    key={`${seg.label}-${seg.start}`}
                    style={{
                      position: 'absolute',
                      left: seg.start * dayWidth,
                      width: seg.length * dayWidth,
                      top: 0, bottom: 0,
                      display: 'flex', alignItems: 'center',
                      padding: '0 8px',
                      fontSize: 11, fontWeight: 700, color: '#B6C2CF',
                      fontFamily: FONT,
                      borderRight: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {seg.label}
                  </div>
                ))}
              </div>
              {/* Linha de dias */}
              <div style={{ position: 'relative', flex: 1 }}>
                {dayCells.map((cell, idx) => (
                  <div
                    key={cell.key}
                    style={{
                      position: 'absolute',
                      left: idx * dayWidth, width: dayWidth,
                      top: 0, bottom: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      borderRight: '1px solid rgba(255,255,255,0.03)',
                      background: cell.isWeekend ? 'rgba(0,0,0,0.20)' : 'transparent',
                    }}
                  >
                    <span style={{
                      fontSize: 9, color: cell.isToday ? '#25D066' : '#7A8593',
                      fontWeight: 700, fontFamily: FONT, lineHeight: 1,
                    }}>
                      {DAYS_PT[cell.date.getDay()]}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, fontFamily: FONT,
                      color: cell.isToday ? '#000' : '#B6C2CF',
                      background: cell.isToday ? '#25D066' : 'transparent',
                      borderRadius: 8, padding: '1px 5px', marginTop: 2,
                    }}>
                      {cell.date.getDate()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* SIDEBAR BODY (sticky left) */}
            <div style={{
              position: 'sticky', left: 0, zIndex: 2,
              background: '#1d2125',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }}>
              {spans.map(s => (
                <div
                  key={s.ticket.id}
                  onClick={() => onOpenTicket(s.ticket.id)}
                  style={{
                    height: ROW_HEIGHT,
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: PRIO_COLORS[s.ticket.priority] ?? '#596773', flexShrink: 0,
                  }} />
                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', fontFamily: FONT,
                  }}>
                    {s.ticket.title}
                  </span>
                  <span style={{ fontSize: 10, color: '#7A8593', fontFamily: FONT, flexShrink: 0 }}>
                    {s.daysSpan}d
                  </span>
                </div>
              ))}
            </div>

            {/* TIMELINE BODY (right side) */}
            <div style={{ position: 'relative' }}>
              {/* Grid de fundo (colunas de dias + weekends) */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {dayCells.map((cell, idx) => (
                  <div
                    key={cell.key}
                    style={{
                      position: 'absolute',
                      left: idx * dayWidth, width: dayWidth,
                      top: 0, bottom: 0,
                      borderRight: '1px solid rgba(255,255,255,0.03)',
                      background: cell.isWeekend ? 'rgba(0,0,0,0.18)' : 'transparent',
                    }}
                  />
                ))}
                {/* Linha vertical de hoje */}
                {todayOffset >= 0 && todayOffset <= totalWidth && (
                  <div style={{
                    position: 'absolute',
                    left: todayOffset, top: 0, bottom: 0,
                    width: 0, borderLeft: '2px dashed rgba(37,208,102,0.45)',
                    zIndex: 1,
                  }} />
                )}
              </div>

              {/* Linhas + barras */}
              {spans.map(s => {
                const isDragging = drag?.ticketId === s.ticket.id
                const previewStart = isDragging ? parseDateKey(drag.preview.startKey) : null
                const previewEnd = isDragging ? parseDateKey(drag.preview.endKey) : null
                const start = previewStart ?? s.start
                const end = previewEnd ?? s.end
                const offsetDays = diffDays(range.start, start)
                const lengthDays = diffDays(start, end) + 1
                const left = offsetDays * dayWidth
                const width = Math.max(dayWidth, lengthDays * dayWidth)
                const color = PRIO_COLORS[s.ticket.priority] ?? '#596773'

                return (
                  <div
                    key={s.ticket.id}
                    style={{
                      position: 'relative',
                      height: ROW_HEIGHT,
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div
                      onPointerDown={e => beginDrag(e, s, 'move')}
                      onClick={e => {
                        if (drag) return // ignora click pós-drag
                        e.stopPropagation()
                        onOpenTicket(s.ticket.id)
                      }}
                      title={`${s.ticket.title} · ${start.toLocaleDateString('pt-BR')} → ${end.toLocaleDateString('pt-BR')} (${lengthDays}d)`}
                      style={{
                        position: 'absolute',
                        left: left + 2,
                        width: width - 4,
                        top: 6, height: ROW_HEIGHT - 12,
                        borderRadius: 7,
                        background: `linear-gradient(180deg, ${color}cc, ${color}99)`,
                        border: `1px solid ${color}`,
                        boxShadow: isDragging ? `0 6px 16px ${color}55` : '0 1px 3px rgba(0,0,0,0.35)',
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '0 12px',
                        fontSize: 11.5, fontWeight: 700, fontFamily: FONT,
                        color: '#000',
                        cursor: drag ? 'grabbing' : 'grab',
                        userSelect: 'none', touchAction: 'none',
                        transition: isDragging ? 'none' : 'box-shadow 0.15s',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Resize handle esquerdo */}
                      <div
                        onPointerDown={e => beginDrag(e, s, 'resize-left')}
                        style={{
                          position: 'absolute',
                          left: 0, top: 0, bottom: 0,
                          width: HANDLE_WIDTH,
                          cursor: 'ew-resize',
                          background: 'rgba(0,0,0,0.18)',
                          borderTopLeftRadius: 7, borderBottomLeftRadius: 7,
                        }}
                      />
                      <span style={{
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        flex: 1, paddingLeft: HANDLE_WIDTH, paddingRight: HANDLE_WIDTH,
                      }}>
                        {s.ticket.title}
                      </span>
                      {/* Resize handle direito */}
                      <div
                        onPointerDown={e => beginDrag(e, s, 'resize-right')}
                        style={{
                          position: 'absolute',
                          right: 0, top: 0, bottom: 0,
                          width: HANDLE_WIDTH,
                          cursor: 'ew-resize',
                          background: 'rgba(0,0,0,0.18)',
                          borderTopRightRadius: 7, borderBottomRightRadius: 7,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tooltip flutuante durante drag */}
          {drag && (() => {
            const start = parseDateKey(drag.preview.startKey)!
            const end = parseDateKey(drag.preview.endKey)!
            return (
              <div style={{
                position: 'fixed',
                left: 'auto', right: 24, bottom: 24,
                background: 'rgba(20,24,28,0.96)',
                border: '1px solid rgba(37,208,102,0.35)',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 12, fontWeight: 700, fontFamily: FONT,
                color: '#E5E7EB',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                zIndex: 50,
              }}>
                <span style={{ color: '#25D066' }}>{drag.mode === 'move' ? 'Movendo' : 'Redimensionando'}</span>
                {' · '}
                {start.toLocaleDateString('pt-BR')} → {end.toLocaleDateString('pt-BR')}
                {' · '}
                <span style={{ color: '#8C96A3' }}>{diffDays(start, end) + 1}d</span>
              </div>
            )
          })()}
        </div>
      )}

      <AnimatePresence>
        {openTicket && (
          <Suspense fallback={null}>
            <CardDetailModal
              ticket={openTicket}
              user={user}
              onClose={onCloseTicket}
              onUpdate={handleTicketUpdate}
              onDelete={handleTicketDelete}
              boardColumns={boardColumns}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: 'none',
  background: 'rgba(255,255,255,0.04)', color: '#8C96A3',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.15s',
}
