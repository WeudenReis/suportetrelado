import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { Clock, AlertCircle, User, Tag, Send, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { Ticket } from '../lib/supabase'

interface CardProps {
  ticket: Ticket
  isDragging?: boolean
  onSendToSlack?: (ticket: Ticket) => void
  slackSending?: boolean
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

function getTimeSinceUpdate(updatedAt: string): { label: string; isStale: boolean } {
  const ms = Date.now() - new Date(updatedAt).getTime()
  const isStale = ms > TWO_HOURS_MS
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  let label: string
  if (days > 0) label = `${days}d atrás`
  else if (hours > 0) label = `${hours}h atrás`
  else if (minutes > 0) label = `${minutes}m atrás`
  else label = 'Agora'
  return { label, isStale }
}

const priorityConfig = {
  high:   { label: 'Alta',  className: 'priority-high',   dot: 'bg-red-400' },
  medium: { label: 'Média', className: 'priority-medium', dot: 'bg-amber-400' },
  low:    { label: 'Baixa', className: 'priority-low',    dot: 'bg-green-400' },
}

const avatarColors = ['from-green-600 to-emerald-500','from-emerald-500 to-teal-500','from-teal-500 to-cyan-500','from-green-500 to-lime-500']

export default function Card({ ticket, isDragging = false, onSendToSlack, slackSending = false }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: ticket.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const { label: timeLabel, isStale } = getTimeSinceUpdate(ticket.updated_at)
  const priority = priorityConfig[ticket.priority]
  const avatarColor = avatarColors[ticket.assignee ? ticket.assignee.charCodeAt(0) % avatarColors.length : 0]

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: isSortableDragging ? 0.4 : 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
        className={clsx('ticket-card rounded-xl p-4 cursor-grab active:cursor-grabbing select-none', isStale && 'inactivity-alert', isDragging && 'dragging-card')}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-xs text-slate-500 font-medium">#{ticket.id.slice(-6).toUpperCase()}</span>
          <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1', priority.className)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', priority.dot)} />{priority.label}
          </span>
        </div>
        <h3 className="text-sm font-bold text-slate-100 leading-snug mb-2 line-clamp-2">{ticket.title}</h3>
        {ticket.description && <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">{ticket.description}</p>}
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <Tag size={10} className="text-slate-500" />
            {ticket.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(37,208,102,0.08)', color: '#86efac', border: '1px solid rgba(37,208,102,0.15)' }}>{tag}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className={clsx('flex items-center gap-1.5 text-[11px]', isStale ? 'text-red-400' : 'text-slate-500')}>
            {isStale ? <AlertCircle size={11} className="animate-pulse" /> : <Clock size={11} />}
            <span className="font-medium">{timeLabel}</span>
            {isStale && <span className="ml-1 text-red-400 font-semibold">· Sem atualização</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {onSendToSlack && ticket.priority === 'high' && (
              <button
                onClick={e => { e.stopPropagation(); onSendToSlack(ticket) }}
                disabled={slackSending}
                title="Enviar para o Slack"
                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-green-500/20"
                style={{ background: 'rgba(37,208,102,0.1)', border: '1px solid rgba(37,208,102,0.2)' }}>
                {slackSending ? <Loader2 size={10} className="animate-spin text-green-400" /> : <Send size={10} className="text-green-400" />}
              </button>
            )}
            {ticket.assignee ? (
              <div className={clsx('w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white', avatarColor)}>
                {ticket.assignee.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)' }}>
                <User size={10} className="text-slate-500" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
