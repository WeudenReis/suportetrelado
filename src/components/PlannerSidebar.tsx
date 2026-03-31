import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import type { Ticket } from '../lib/supabase'

interface PlannerSidebarProps {
  tickets: Ticket[]
  onClose: () => void
}

const DAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const PRIO_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }

export default function PlannerSidebar({ tickets, onClose }: PlannerSidebarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days: { date: number; isCurrentMonth: boolean; fullDate: string }[] = []
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
      days.push({ date: d, isCurrentMonth: false, fullDate: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: d, isCurrentMonth: true, fullDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }
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

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const selectedTickets = ticketsByDate[selectedDate] || []

  return (
    <div className="sidebar-root h-full flex-shrink-0 relative z-30 flex" style={{ width: 300 }}>
      <div className="flex flex-col flex-1 overflow-hidden px-3 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.16)' }}>
              <CalendarDays size={15} className="text-blue-300" />
            </div>
            <span className="text-lg font-bold truncate" style={{ color: '#ffffff' }}>Planejador</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: '#9fb0c2' }}>
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2 px-1">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-white/10" style={{ color: '#9fb0c2' }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold" style={{ color: '#dfe1e6' }}>
            {MONTHS_PT[month]} {year}
          </span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-white/10" style={{ color: '#9fb0c2' }}>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Mini calendar */}
        <div className="grid grid-cols-7 gap-0.5 mb-3">
          {DAYS_PT.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold uppercase py-1" style={{ color: '#6b7280' }}>{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            const hasTickets = (ticketsByDate[day.fullDate] || []).length > 0
            const isToday = day.fullDate === todayStr
            const isSelected = day.fullDate === selectedDate
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day.fullDate)}
                className="relative w-full aspect-square rounded-md flex items-center justify-center text-[11px] font-medium transition-all hover:bg-white/10"
                style={{
                  color: !day.isCurrentMonth ? '#4b5563' : isSelected ? '#fff' : isToday ? '#60a5fa' : '#d1d5db',
                  background: isSelected ? '#3b82f6' : isToday ? 'rgba(59,130,246,0.12)' : 'transparent',
                }}
              >
                {day.date}
                {hasTickets && !isSelected && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: '#3b82f6' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Selected day tickets */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          <div className="text-[10px] font-bold uppercase tracking-wide px-1 mb-1" style={{ color: '#9fadbc' }}>
            {selectedDate === todayStr ? 'Hoje' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            {' '}({selectedTickets.length} {selectedTickets.length === 1 ? 'cartão' : 'cartões'})
          </div>
          {selectedTickets.length === 0 ? (
            <div className="text-xs text-center py-6" style={{ color: '#6b7280' }}>Nenhum cartão nesta data</div>
          ) : (
            selectedTickets.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg p-2.5 cursor-default"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PRIO_COLORS[t.priority] || '#6b7280' }} />
                  <span className="text-xs font-semibold truncate" style={{ color: '#dfe1e6' }}>{t.title}</span>
                </div>
                {t.description && (
                  <p className="text-[10px] line-clamp-1 ml-3.5" style={{ color: '#9fadbc' }}>{t.description}</p>
                )}
                <div className="text-[9px] ml-3.5 mt-0.5" style={{ color: '#6b7280' }}>
                  {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
