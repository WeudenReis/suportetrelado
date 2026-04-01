import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react'
import type { Ticket } from '../lib/supabase'

interface PlannerSidebarProps {
  tickets: Ticket[]
  onClose: () => void
}

const DAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const PRIO_COLORS: Record<string, string> = { high: '#ef5c48', medium: '#F5A623', low: '#25D066' }
const PRIO_LABELS: Record<string, string> = { high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA' }

const font = "'Space Grotesk', sans-serif"

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
      days.push({ date: d, isCurrentMonth: false, fullDate: `--` })
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: d, isCurrentMonth: true, fullDate: `--` })
    }
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: d, isCurrentMonth: false, fullDate: `--` })
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
  const todayStr = `--`

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const selectedTickets = ticketsByDate[selectedDate] || []

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* HEADER */}
      <div data-gsap-child style={{ padding: '20px 20px 16px' }}>
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
                {tickets.length} cartão{tickets.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
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

      {/* MONTH NAVIGATION */}
      <div data-gsap-child style={{
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
      <div data-gsap-child style={{ padding: '0 20px 14px' }}>
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
            const isToday = day.fullDate === todayStr
            const isSelected = day.fullDate === selectedDate
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day.fullDate)}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, fontFamily: font,
                  border: 'none', cursor: 'pointer', position: 'relative',
                  color: !day.isCurrentMonth ? '#3B4754' : isSelected ? '#000' : isToday ? '#25D066' : '#B6C2CF',
                  background: isSelected ? '#25D066' : isToday ? 'rgba(37,208,102,0.12)' : 'transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'rgba(37,208,102,0.12)' : 'transparent' }}
              >
                {day.date}
                {hasTickets && !isSelected && (
                  <span style={{
                    position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%', background: '#25D066',
                  }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* SELECTED DAY TICKETS */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '12px 20px 8px',
      }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: '#25D066', margin: '0 0 8px',
          fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {selectedDate === todayStr ? 'Hoje' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          {' '}
          <span style={{ color: '#596773' }}>({selectedTickets.length} {selectedTickets.length === 1 ? 'cartão' : 'cartões'})</span>
        </p>
      </div>

      <div className="inbox-scroll" style={{
        flex: 1, overflowY: 'auto', padding: '0 20px 80px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {selectedTickets.length === 0 ? (
          <p style={{
            textAlign: 'center', padding: '32px 0',
            fontSize: 12, color: '#596773', fontFamily: font,
          }}>
            Nenhum cartão nesta data
          </p>
        ) : (
          selectedTickets.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                borderRadius: 10, padding: '10px 12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                transition: 'all 0.15s',
              }}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: PRIO_COLORS[t.priority] || '#596773',
                }} />
                <p style={{
                  fontSize: 12, fontWeight: 600, color: '#E5E7EB', margin: 0,
                  fontFamily: font,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t.title}
                </p>
                <span style={{ flex: 1 }} />
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  fontFamily: font,
                  background: `18`,
                  color: PRIO_COLORS[t.priority] || '#596773',
                }}>
                  {PRIO_LABELS[t.priority] || t.priority}
                </span>
              </div>
              {t.description && (
                <p style={{
                  fontSize: 11, color: '#8C96A3', margin: '2px 0 0 12px',
                  fontFamily: font,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t.description}
                </p>
              )}
              <p style={{
                fontSize: 10, color: '#596773', margin: '2px 0 0 12px',
                fontFamily: font,
              }}>
                {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
