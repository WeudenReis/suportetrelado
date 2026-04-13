import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CalendarDays, X, Settings, Plus, AlignLeft } from 'lucide-react'
import type { Ticket, PlannerEvent } from '../lib/supabase'
import { fetchPlannerEvents, insertPlannerEvent, updatePlannerEvent, deletePlannerEvent, insertNotification } from '../lib/supabase'
import { useOrg } from '../lib/org'
import PlannerEventModal from './PlannerEventModal'
import PlannerSettingsPanel from './PlannerSettingsPanel'

interface PlannerSidebarProps {
  tickets: Ticket[]
  onClose: () => void
  user: string
  onOpenTicket: (ticketId: string) => void
}

const DAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const PRIO_COLORS: Record<string, string> = { high: '#ef5c48', medium: '#F5A623', low: '#25D066' }
const PRIO_LABELS: Record<string, string> = { high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA' }

const font = "'Space Grotesk', sans-serif"

export default function PlannerSidebar({ tickets, onClose, user, onOpenTicket }: PlannerSidebarProps) {
  const { departmentId } = useOrg()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<PlannerEvent[]>([])
  
  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [eventToEdit, setEventToEdit] = useState<PlannerEvent | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [selectedDate, setSelectedDate] = useState(todayStr)

  const localKey = `plannerEvents:${user}`

  useEffect(() => {
    // Load local fallback first for instant UI
    const localRaw = localStorage.getItem(localKey)
    const localEvents: PlannerEvent[] = localRaw ? JSON.parse(localRaw) : []
    if (localEvents.length > 0) setEvents(localEvents) // eslint-disable-line react-hooks/set-state-in-effect -- carregamento inicial do localStorage

    // Then load from Supabase and merge
    fetchPlannerEvents(user).then(remoteEvents => {
      if (remoteEvents.length > 0) {
        // Merge: remote wins for same id, keep local-only ones
        const remoteIds = new Set(remoteEvents.map(e => e.id))
        const localOnly = localEvents.filter(e => !remoteIds.has(e.id))
        const merged = [...remoteEvents, ...localOnly]
        setEvents(merged)
        localStorage.setItem(localKey, JSON.stringify(merged))
      }
    })
  }, [user, localKey])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days: { date: number; isCurrentMonth: boolean; fullDate: string }[] = []
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    const pad = (n: number) => String(n).padStart(2, '0')
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
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
  }, [year, month])

  // Tickets organized by created date AND due date
  const ticketsByDate = useMemo(() => {
    const map: Record<string, Ticket[]> = {}
    tickets.forEach(t => {
      // By creation
      const createdKey = t.created_at.slice(0, 10)
      if (!map[createdKey]) map[createdKey] = []
      map[createdKey].push(t)
      
      // By due_date
      if (t.due_date) {
        const dueKey = t.due_date.slice(0, 10)
        // Only push if it's different to avoid duplicate if created and due on same day
        if (dueKey !== createdKey) {
          if (!map[dueKey]) map[dueKey] = []
          if (!map[dueKey].find(existing => existing.id === t.id)) {
            map[dueKey].push(t)
          }
        }
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

  const selectedTickets = ticketsByDate[selectedDate] || []
  const selectedEvents = eventsByDate[selectedDate] || []

  // Day click logic
  const handleDayClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      // Abre modal se clicar duas vezes no mesmo dia
      setEventToEdit(null)
      setIsEventModalOpen(true)
    } else {
      setSelectedDate(dateStr)
    }
  }

  const handleSaveEvent = async (eventData: Omit<PlannerEvent, 'id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString()
    if (eventToEdit) {
      // Optimistic update always
      const updated: PlannerEvent = { ...eventToEdit, ...eventData, updated_at: now }
      setEvents(prev => {
        const next = prev.map(e => e.id === eventToEdit.id ? updated : e)
        localStorage.setItem(localKey, JSON.stringify(next))
        return next
      })
      await updatePlannerEvent(eventToEdit.id, eventData)
    } else {
      // Always add optimistically with a temp local ID
      const tempId = `local_${Date.now()}`
      const localEvent: PlannerEvent = {
        ...eventData, id: tempId, created_at: now, updated_at: now
      }
      setEvents(prev => {
        const next = [...prev, localEvent]
        localStorage.setItem(localKey, JSON.stringify(next))
        return next
      })
      // Also jump to the event's date
      setSelectedDate(eventData.date)

      // Try to persist to Supabase and swap temp id for real one
      const created = await insertPlannerEvent(eventData)
      if (created) {
        setEvents(prev => {
          const next = prev.map(e => e.id === tempId ? created : e)
          localStorage.setItem(localKey, JSON.stringify(next))
          return next
        })
      }

      // Gerar notificação imediata do evento criado
      const timeLabel = eventData.start_time ? ` às ${eventData.start_time}` : ''
      insertNotification({
        department_id: departmentId || '',
        recipient_email: user,
        sender_name: 'Sistema',
        type: 'planner_event',
        ticket_id: null,
        ticket_title: eventData.title,
        message: `Evento "${eventData.title}" agendado para ${eventData.date}${timeLabel}.`,
      }).catch(() => { /* notificação é best-effort */ })
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

  // Verificar se uma data tem cartões vencendo
  const isDueToday = (fullDate: string) => {
    if (fullDate !== todayStr) return false
    const ticketsToday = ticketsByDate[fullDate] || []
    return ticketsToday.some(t => t.due_date?.startsWith(fullDate))
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
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

      {/* HEADER */}
      <div data-stagger-child style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(37,208,102,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CalendarDays size={16} style={{ color: '#25D066' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: 15, fontWeight: 900, color: '#E5E7EB', margin: 0,
                fontFamily: "'Paytone One', sans-serif",
              }}>
                Planejador
              </h2>
              <p style={{ fontSize: 11, color: '#596773', margin: 0, fontFamily: font }}>
                Eventos e Entregas
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Configurações"
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'transparent', color: '#596773', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
            >
              <Settings size={15} />
            </button>
            <button
              onClick={onClose}
              title="Fechar"
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'transparent', color: '#596773', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* MONTH NAVIGATION */}
      <div data-stagger-child style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px 12px',
      }}>
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.04)', color: '#8C96A3', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        >
          <ChevronLeft size={14} />
        </button>
        <span style={{
          fontSize: 13, fontWeight: 700, color: '#E5E7EB', fontFamily: font,
        }}>
          {MONTHS_PT[month]} {year}
        </span>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.04)', color: '#8C96A3', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* MINI CALENDAR */}
      <div data-stagger-child style={{ padding: '0 20px 14px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
        }}>
          {DAYS_PT.map((d, i) => (
            <div key={i} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: '#596773', padding: '4px 0',
              fontFamily: font, textTransform: 'uppercase',
            }}>{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            const hasTickets = (ticketsByDate[day.fullDate] || []).length > 0
            const hasEvents = (eventsByDate[day.fullDate] || []).length > 0
            const isToday = day.fullDate === todayStr
            const isSelected = day.fullDate === selectedDate
            const hasDueToday = isDueToday(day.fullDate)

            let borderColor = 'transparent'
            if (hasDueToday && !isSelected) borderColor = 'rgba(245,166,35,0.5)'
            
            return (
              <div key={i} style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
                <button
                  onClick={() => handleDayClick(day.fullDate)}
                  style={{
                    width: '100%', height: '100%', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600, fontFamily: font,
                    border: `1px solid ${borderColor}`, cursor: 'pointer',
                    color: !day.isCurrentMonth ? '#3B4754' : isSelected ? '#000' : isToday ? '#25D066' : '#B6C2CF',
                    background: isSelected ? '#25D066' : isToday ? 'rgba(37,208,102,0.12)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'rgba(37,208,102,0.12)' : 'transparent' }}
                  title="Duplo clique para adicionar evento"
                >
                  {day.date}
                </button>
                {/* Dots container bottom center */}
                <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2, pointerEvents: 'none' }}>
                  {hasTickets && !isSelected && (
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#25D066' }} />
                  )}
                  {hasEvents && !isSelected && (
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#579dff' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SELECTED DAY SECTION */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '12px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: '#25D066', margin: 0,
          fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {selectedDate === todayStr ? 'Hoje' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          {' '}
          <span style={{ color: '#596773' }}>({selectedTickets.length + selectedEvents.length} Itens)</span>
        </p>
        <button
          onClick={() => { setEventToEdit(null); setIsEventModalOpen(true) }}
          style={{
            background: 'rgba(87,157,255,0.1)', color: '#579dff', border: 'none', borderRadius: 6,
            padding: '4px 8px', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            fontFamily: font
          }}
        >
          <Plus size={12} /> Evento
        </button>
      </div>

      <div className="inbox-scroll" style={{
        flex: 1, overflowY: 'auto', padding: '0 20px 80px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {(selectedTickets.length === 0 && selectedEvents.length === 0) ? (
          <p style={{
            textAlign: 'center', padding: '32px 0',
            fontSize: 12, color: '#596773', fontFamily: font,
          }}>
            Nenhum evento ou cartão nesta data
          </p>
        ) : (
          <>
            {/* EVENTOS */}
            {selectedEvents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#8C96A3', textTransform: 'uppercase', marginBottom: 2, fontFamily: font }}>
                  Meus Eventos
                </p>
                {selectedEvents.map(e => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => { setEventToEdit(e); setIsEventModalOpen(true) }}
                    style={{
                      borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${e.color}`,
                      borderTop: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#E5E7EB', margin: 0, fontFamily: font, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.title}
                      </p>
                      {e.start_time && (
                        <p style={{ fontSize: 10, fontWeight: 600, color: '#8C96A3', margin: 0, fontFamily: font, flexShrink: 0 }}>
                          {e.start_time} {e.end_time ? `- ${e.end_time}` : ''}
                        </p>
                      )}
                    </div>
                    {e.description && (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                        <AlignLeft size={10} color="#596773" />
                        <p style={{ fontSize: 11, color: '#8C96A3', margin: 0, fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.description}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* CARTÕES */}
            {selectedTickets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#8C96A3', textTransform: 'uppercase', marginBottom: 2, fontFamily: font }}>
                  Cartões
                </p>
                {selectedTickets.map(t => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => onOpenTicket(t.id)}
                    style={{
                      borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      transition: 'all 0.15s',
                    }}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(37,208,102,0.3)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: PRIO_COLORS[t.priority] || '#596773' }} />
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#E5E7EB', margin: 0, fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </p>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, fontFamily: font, background: `${PRIO_COLORS[t.priority] || '#596773'}18`, color: PRIO_COLORS[t.priority] || '#596773' }}>
                        {PRIO_LABELS[t.priority] || t.priority}
                      </span>
                    </div>
                    {t.due_date && t.due_date.startsWith(selectedDate) && (
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#F5A623', margin: '4px 0 0 12px', fontFamily: font }}>
                        Vence nesta data
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
