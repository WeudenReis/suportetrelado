import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../lib/icons'
import {
  fetchTickets,
  fetchPlannerEvents,
  insertPlannerEvent,
  updatePlannerEvent,
  deletePlannerEvent,
  insertNotification,
  type Ticket,
  type PlannerEvent,
} from '../../lib/supabase'
import { updateTicket } from '../../lib/api/tickets'
import { fetchBoardColumns, type BoardColumn } from '../../lib/boardColumns'
import { useOrg } from '../../lib/orgContext'
import { logger } from '../../lib/logger'
import PlannerEventModal from '../PlannerEventModal'
import PlannerSettingsPanel from '../PlannerSettingsPanel'
import ViewSwitcher, { type WorkView } from '../workspace/ViewSwitcher'

const CardDetailModal = lazy(() => import('../CardDetailModal'))

interface CalendarViewProps {
  user: string
  openTicketId: string | null
  onCloseTicket: () => void
  onOpenTicket: (id: string) => void
  view: WorkView
  onChangeView: (view: WorkView) => void
}

const DAYS_PT_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const PRIO_COLORS: Record<string, string> = { high: '#ef5c48', medium: '#F5A623', low: '#25D066' }
const FONT = "'Space Grotesk', sans-serif"
const DRAG_MIME = 'application/x-trelado-ticket-id'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface DayCell {
  date: number
  isCurrentMonth: boolean
  fullDate: string
}

function buildCalendar(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = firstDay.getDay()
  const totalDays = lastDay.getDate()
  const days: DayCell[] = []
  const prevLast = new Date(year, month, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevLast - i
    const pm = month === 0 ? 12 : month
    const py = month === 0 ? year - 1 : year
    days.push({ date: d, isCurrentMonth: false, fullDate: `${py}-${pad(pm)}-${pad(d)}` })
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push({ date: d, isCurrentMonth: true, fullDate: `${year}-${pad(month + 1)}-${pad(d)}` })
  }
  const remaining = 42 - days.length
  const nm = month === 11 ? 1 : month + 2
  const ny = month === 11 ? year + 1 : year
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: d, isCurrentMonth: false, fullDate: `${ny}-${pad(nm)}-${pad(d)}` })
  }
  return days
}

export default function CalendarView({ user, openTicketId, onCloseTicket, onOpenTicket, view, onChangeView }: CalendarViewProps) {
  const { departmentId } = useOrg()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [events, setEvents] = useState<PlannerEvent[]>([])
  const [boardColumns, setBoardColumns] = useState<BoardColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey())
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [eventToEdit, setEventToEdit] = useState<PlannerEvent | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const todayStr = todayKey()
  const localKey = `plannerEvents:${user}`

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [t, ev, cols] = await Promise.all([
        fetchTickets({ departmentId: departmentId ?? undefined }),
        fetchPlannerEvents(user),
        fetchBoardColumns(departmentId ?? undefined),
      ])
      setTickets(t.filter(tk => !tk.is_archived))
      setBoardColumns(cols)
      if (ev.length > 0) {
        setEvents(ev)
        localStorage.setItem(localKey, JSON.stringify(ev))
      }
    } catch (err) {
      logger.error('CalendarView', 'Falha ao carregar dados', { error: String(err) })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [departmentId, user, localKey])

  useEffect(() => {
    const raw = localStorage.getItem(localKey)
    if (raw) {
      try { setEvents(JSON.parse(raw) as PlannerEvent[]) } catch { /* ignore corrupt cache */ }
    }
    loadData()
  }, [loadData, localKey])

  const calendarDays = useMemo(() => buildCalendar(year, month), [year, month])

  const ticketsByDate = useMemo(() => {
    const map: Record<string, Ticket[]> = {}
    tickets.forEach(t => {
      if (t.due_date) {
        const key = t.due_date.slice(0, 10)
        if (!map[key]) map[key] = []
        map[key].push(t)
      }
    })
    return map
  }, [tickets])

  const eventsByDate = useMemo(() => {
    const map: Record<string, PlannerEvent[]> = {}
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [events])

  const monthCounts = useMemo(() => {
    let evs = 0
    let tks = 0
    calendarDays.forEach(d => {
      if (!d.isCurrentMonth) return
      evs += eventsByDate[d.fullDate]?.length ?? 0
      tks += ticketsByDate[d.fullDate]?.length ?? 0
    })
    return { evs, tks }
  }, [calendarDays, eventsByDate, ticketsByDate])

  const goPrev = () => setCurrentDate(new Date(year, month - 1, 1))
  const goNext = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(todayStr)
  }

  const openNewEvent = (date: string) => {
    setSelectedDate(date)
    setEventToEdit(null)
    setIsEventModalOpen(true)
  }

  const openEditEvent = (e: PlannerEvent) => {
    setSelectedDate(e.date)
    setEventToEdit(e)
    setIsEventModalOpen(true)
  }

  const handleSaveEvent = async (eventData: Omit<PlannerEvent, 'id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString()
    if (eventToEdit) {
      const updated: PlannerEvent = { ...eventToEdit, ...eventData, updated_at: now }
      setEvents(prev => {
        const next = prev.map(e => (e.id === eventToEdit.id ? updated : e))
        localStorage.setItem(localKey, JSON.stringify(next))
        return next
      })
      await updatePlannerEvent(eventToEdit.id, eventData)
    } else {
      const tempId = `local_${Date.now()}`
      const local: PlannerEvent = { ...eventData, id: tempId, created_at: now, updated_at: now }
      setEvents(prev => {
        const next = [...prev, local]
        localStorage.setItem(localKey, JSON.stringify(next))
        return next
      })
      const created = await insertPlannerEvent(eventData)
      if (created) {
        setEvents(prev => {
          const next = prev.map(e => (e.id === tempId ? created : e))
          localStorage.setItem(localKey, JSON.stringify(next))
          return next
        })
      }
      const deptId = departmentId || '00000000-0000-0000-0000-000000000010'
      const timeLabel = eventData.start_time ? ` às ${eventData.start_time}` : ''
      insertNotification({
        department_id: deptId,
        recipient_email: user,
        sender_name: 'Sistema',
        type: 'planner_event',
        ticket_id: null,
        ticket_title: eventData.title,
        message: `Evento "${eventData.title}" agendado para ${eventData.date}${timeLabel}.`,
      }).catch(() => { /* best-effort */ })
    }
  }

  const handleDeleteEvent = async (id: string) => {
    setEvents(prev => {
      const next = prev.filter(e => e.id !== id)
      localStorage.setItem(localKey, JSON.stringify(next))
      return next
    })
    await deletePlannerEvent(id)
  }

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(DRAG_MIME, ticketId)
    e.dataTransfer.setData('text/plain', ticketId)
  }

  const handleDragOver = (e: React.DragEvent, fullDate: string) => {
    if (e.dataTransfer.types.includes(DRAG_MIME) || e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragOverDate !== fullDate) setDragOverDate(fullDate)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (related && (e.currentTarget as Node).contains(related)) return
    setDragOverDate(prev => (prev === e.currentTarget.getAttribute('data-date') ? null : prev))
  }

  const handleDrop = async (e: React.DragEvent, fullDate: string) => {
    e.preventDefault()
    setDragOverDate(null)
    const ticketId = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain')
    if (!ticketId) return
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket) return
    const currentKey = ticket.due_date ? ticket.due_date.slice(0, 10) : null
    if (currentKey === fullDate) return

    const prevDue = ticket.due_date ?? null
    setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, due_date: fullDate } : t)))
    try {
      await updateTicket(ticketId, { due_date: fullDate })
    } catch (err) {
      logger.error('CalendarView', 'Falha ao atualizar due_date', { error: String(err), ticketId })
      setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, due_date: prevDue } : t)))
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
  const selectedTickets = ticketsByDate[selectedDate] || []
  const selectedEvents = eventsByDate[selectedDate] || []

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#1d2125', overflow: 'hidden' }}>
      <PlannerSettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} userEmail={user} />
      <PlannerEventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        userEmail={user}
        selectedDate={selectedDate}
        existingEvent={eventToEdit}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />

      {/* TOOLBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 20px 6px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(34,39,43,0.55)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ViewSwitcher active={view} onChange={onChangeView} />
          <div style={{
            paddingLeft: 8,
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(37,208,102,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="CalendarDays" size={15} style={{ color: '#25D066' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: 14, fontWeight: 800, color: '#E5E7EB', margin: 0,
                fontFamily: "'Paytone One', sans-serif",
              }}>
                {MONTHS_PT[month]} {year}
              </h2>
              <p style={{ fontSize: 10.5, color: '#596773', margin: 0, fontFamily: FONT }}>
                {monthCounts.tks} cartão{monthCounts.tks === 1 ? '' : 'es'} · {monthCounts.evs} evento{monthCounts.evs === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={goPrev}
            title="Mês anterior"
            style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          >
            <Icon name="ChevronLeft" size={15} />
          </button>
          <button
            onClick={goToday}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(37,208,102,0.25)',
              background: 'rgba(37,208,102,0.08)', color: '#25D066',
              fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.16)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
          >
            Hoje
          </button>
          <button
            onClick={goNext}
            title="Próximo mês"
            style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          >
            <Icon name="ChevronRight" size={15} />
          </button>

          <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Atualizar"
            style={{ ...navBtnStyle, opacity: refreshing ? 0.5 : 1, cursor: refreshing ? 'wait' : 'pointer' }}
            onMouseEnter={e => { if (!refreshing) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { if (!refreshing) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          >
            <Icon name="RefreshCw" size={14} className={refreshing ? 'animate-spin' : undefined} />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Configurações"
            style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          >
            <Icon name="Settings" size={14} />
          </button>
          <button
            onClick={() => openNewEvent(selectedDate)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: '#25D066', color: '#000',
              fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1BAD53' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#25D066' }}
          >
            <Icon name="Plus" size={13} strokeWidth={2.5} />
            Novo Evento
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#596773' }}>
          <Icon name="Loader2" size={22} className="animate-spin" />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* WEEKDAY HEADER */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            {DAYS_PT_FULL.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: i === 0 || i === 6 ? '#7A8593' : '#8C96A3',
                  fontFamily: FONT,
                  borderRight: i === 6 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  background: 'rgba(34,39,43,0.35)',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* MONTH GRID */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: 'repeat(6, 1fr)',
            minHeight: 0,
            overflow: 'hidden',
          }}>
            {calendarDays.map((day, idx) => {
              const cellTickets = ticketsByDate[day.fullDate] || []
              const cellEvents = eventsByDate[day.fullDate] || []
              const total = cellTickets.length + cellEvents.length
              const isToday = day.fullDate === todayStr
              const isSelected = day.fullDate === selectedDate
              const isDropTarget = dragOverDate === day.fullDate
              const col = idx % 7
              const row = Math.floor(idx / 7)
              const visibleEvents = cellEvents.slice(0, 2)
              const visibleTickets = cellTickets.slice(0, Math.max(0, 3 - visibleEvents.length))
              const hidden = total - visibleEvents.length - visibleTickets.length

              return (
                <div
                  key={day.fullDate + '-' + idx}
                  data-date={day.fullDate}
                  onClick={() => setSelectedDate(day.fullDate)}
                  onDoubleClick={() => openNewEvent(day.fullDate)}
                  onDragOver={e => handleDragOver(e, day.fullDate)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, day.fullDate)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    padding: '6px 8px 8px',
                    borderRight: col === 6 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    borderBottom: row === 5 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    background: isDropTarget
                      ? 'rgba(37,208,102,0.10)'
                      : !day.isCurrentMonth
                        ? 'rgba(0,0,0,0.18)'
                        : isSelected
                          ? 'rgba(37,208,102,0.05)'
                          : 'transparent',
                    boxShadow: isDropTarget
                      ? 'inset 0 0 0 2px rgba(37,208,102,0.55)'
                      : isSelected
                        ? 'inset 0 0 0 1px rgba(37,208,102,0.30)'
                        : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s, box-shadow 0.15s',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 4, flexShrink: 0,
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11,
                      fontSize: 11, fontWeight: 700, fontFamily: FONT,
                      color: !day.isCurrentMonth ? '#3B4754' : isToday ? '#000' : '#B6C2CF',
                      background: isToday ? '#25D066' : 'transparent',
                    }}>
                      {day.date}
                    </span>
                    {total > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, fontFamily: FONT,
                        color: '#7A8593', letterSpacing: '0.04em',
                      }}>
                        {total}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, flex: 1, overflow: 'hidden' }}>
                    {visibleEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={e => { e.stopPropagation(); openEditEvent(ev) }}
                        title={ev.title}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '2px 6px', borderRadius: 4, border: 'none',
                          background: `${ev.color}22`, color: ev.color,
                          fontSize: 10.5, fontWeight: 600, fontFamily: FONT,
                          cursor: 'pointer', textAlign: 'left',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ width: 4, height: 4, borderRadius: 2, background: ev.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.start_time ? `${ev.start_time} ${ev.title}` : ev.title}
                        </span>
                      </button>
                    ))}
                    {visibleTickets.map(t => (
                      <button
                        key={t.id}
                        draggable
                        onDragStart={e => handleDragStart(e, t.id)}
                        onClick={e => { e.stopPropagation(); onOpenTicket(t.id) }}
                        title={t.title}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '2px 6px', borderRadius: 4,
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#B6C2CF',
                          fontSize: 10.5, fontWeight: 600, fontFamily: FONT,
                          cursor: 'grab', textAlign: 'left',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: PRIO_COLORS[t.priority] ?? '#596773',
                          flexShrink: 0,
                        }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title}
                        </span>
                      </button>
                    ))}
                    {hidden > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, fontFamily: FONT,
                        color: '#7A8593', padding: '2px 6px',
                      }}>
                        +{hidden} mais
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* SELECTED DAY DRAWER */}
          <AnimatePresence initial={false}>
            {(selectedTickets.length > 0 || selectedEvents.length > 0) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(34,39,43,0.45)',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#25D066', fontFamily: FONT,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {selectedDate === todayStr
                      ? 'Hoje'
                      : new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </span>
                  <span style={{ fontSize: 11, color: '#7A8593', fontFamily: FONT }}>
                    {selectedTickets.length + selectedEvents.length} item{selectedTickets.length + selectedEvents.length === 1 ? '' : 'ns'}
                  </span>
                  <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => openEditEvent(ev)}
                        style={chipStyle(ev.color)}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: ev.color }} />
                        {ev.title}
                      </button>
                    ))}
                    {selectedTickets.map(t => (
                      <button
                        key={t.id}
                        onClick={() => onOpenTicket(t.id)}
                        style={chipStyle(PRIO_COLORS[t.priority] ?? '#596773', true)}
                      >
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: PRIO_COLORS[t.priority] ?? '#596773',
                        }} />
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

const navBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: 'none',
  background: 'rgba(255,255,255,0.04)', color: '#8C96A3',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.15s',
}

function chipStyle(color: string, neutral = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 999,
    border: `1px solid ${neutral ? 'rgba(255,255,255,0.08)' : `${color}55`}`,
    background: neutral ? 'rgba(255,255,255,0.04)' : `${color}18`,
    color: neutral ? '#B6C2CF' : color,
    fontSize: 11, fontWeight: 600, fontFamily: FONT,
    cursor: 'pointer', maxWidth: 240,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }
}
