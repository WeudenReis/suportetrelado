import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import type { Ticket } from '../lib/supabase'

interface PlannerViewProps {
  tickets: Ticket[]
  onCardClick?: (ticket: Ticket) => void
}

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
}

export default function PlannerView({ tickets, onCardClick }: PlannerViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days: { date: number; isCurrentMonth: boolean; fullDate: string }[] = []

    // Previous month fill
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
      days.push({ date: d, isCurrentMonth: false, fullDate: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: d, isCurrentMonth: true, fullDate: dateStr })
    }

    // Next month fill
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: d, isCurrentMonth: false, fullDate: `${year}-${String(month + 2).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }

    return days
  }, [year, month])

  const ticketsByDate = useMemo(() => {
    const map: Record<string, Ticket[]> = {}
    tickets.forEach(t => {
      const dateKey = t.created_at.slice(0, 10)
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(t)
    })
    return map
  }, [tickets])

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  return (
    <div className="planner-view">
      {/* Calendar Header */}
      <div className="planner-header">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {MONTHS_PT[month]} {year}
          </h2>
          <button onClick={goToday} className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="planner-grid planner-grid--header">
        {DAYS_PT.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider py-2" style={{ color: 'var(--text-muted)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="planner-grid">
        {calendarDays.map((day, i) => {
          const dayTickets = ticketsByDate[day.fullDate] || []
          const isToday = day.fullDate === todayStr
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.005 }}
              className="planner-cell"
              style={{
                opacity: day.isCurrentMonth ? 1 : 0.3,
                background: isToday ? 'rgba(59,130,246,0.08)' : 'transparent',
                borderColor: isToday ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.04)',
              }}
            >
              <span className={`planner-cell__date ${isToday ? 'planner-cell__date--today' : ''}`}>
                {day.date}
              </span>
              <div className="planner-cell__tickets">
                {dayTickets.slice(0, 3).map(t => (
                  <button
                    key={t.id}
                    onClick={() => onCardClick?.(t)}
                    className="planner-ticket"
                    title={t.title}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLORS[t.priority] || '#6b7280' }} />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {dayTickets.length > 3 && (
                  <span className="text-[9px] font-semibold px-1" style={{ color: 'var(--text-muted)' }}>
                    +{dayTickets.length - 3} mais
                  </span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Summary bar */}
      <div className="planner-summary">
        <Clock size={13} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {tickets.filter(t => t.status !== 'resolved').length} tickets abertos &middot; {tickets.filter(t => t.status === 'resolved').length} resolvidos
        </span>
      </div>
    </div>
  )
}
