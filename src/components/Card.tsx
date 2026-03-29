import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Clock, AlertCircle, AlignLeft, User, Calendar, Pencil } from 'lucide-react'
import { clsx } from 'clsx'
import type { Ticket } from '../lib/supabase'

interface CardProps {
  ticket: Ticket
  isDragging?: boolean
  onCardClick?: (ticket: Ticket) => void
  onEditCover?: (e: React.MouseEvent) => void
}

const TWO_HOURS = 2 * 60 * 60 * 1000

function timeAgo(updatedAt: string) {
  const ms = Date.now() - new Date(updatedAt).getTime()
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  const isStale = ms > TWO_HOURS
  const label = days > 0 ? `${days}d` : hrs > 0 ? `${hrs}h` : mins > 0 ? `${mins}min` : 'agora'
  return { label, isStale }
}

const PRIO_COLOR: Record<string, string> = { high: '#ef5c48', medium: '#f5a623', low: '#4bce97' }
const PRIO_LABEL: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }

function Card({ ticket, isDragging = false, onCardClick, onEditCover }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sorting } = useSortable({
    id: ticket.id,
    data: { type: 'ticket', ticket },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const { label: time, isStale } = timeAgo(ticket.updated_at)

  const createdDate = new Date(ticket.created_at)
  const createdLabel = createdDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ', ' + createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={e => { if (!sorting && onCardClick) { e.stopPropagation(); onCardClick(ticket) } }}
        className={clsx('trello-card group', isStale && 'trello-card--stale', isDragging && 'trello-card--drag')}
        style={{ overflow: 'hidden', position: 'relative', marginBottom: 8 }}
      >
        {/* ===== CAPA ===== */}
        {ticket.cover_image_url && (
          <div className="card-cover" style={{ position: 'relative', width: '100%', height: 160, background: '#1d2125', flexShrink: 0 }}>
            <img
              src={ticket.cover_image_url}
              alt=""
              className="card-cover-img"
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
            />
            {/* Botão editar capa — para ao clicar para não abrir o modal */}
            <button
              className="card-cover-edit-btn"
              onClick={e => { e.stopPropagation(); onEditCover?.(e) }}
              title="Editar capa"
              type="button"
              style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 4, background: 'rgba(23,43,77,0.75)', border: 'none', color: '#b6c2cf', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s, background 0.15s', backdropFilter: 'blur(4px)' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <Pencil size={13} />
            </button>
          </div>
        )}

        {/* ===== CORPO ===== */}
        <div className="flex flex-wrap gap-1 mb-2">
          <span
            className="h-4 px-2 rounded-sm text-[10px] font-bold leading-[16px] cursor-pointer hover:h-5 hover:leading-[20px] transition-all inline-flex items-center text-white"
            style={{ background: PRIO_COLOR[ticket.priority] }}
            title={`Prioridade: ${PRIO_LABEL[ticket.priority]}`}
          >
            {PRIO_LABEL[ticket.priority]}
          </span>
          {ticket.tags?.slice(0, 4).map((tag, i) => (
            <span
              key={tag}
              className="h-4 px-2 rounded-sm text-[10px] font-bold leading-[16px] cursor-pointer hover:h-5 hover:leading-[20px] transition-all inline-flex items-center text-white"
              style={{ background: `hsl(${(tag.charCodeAt(0) * 47 + i * 80) % 360}, 55%, 45%)` }}
              title={tag}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <p className="text-[13.5px] font-medium leading-snug line-clamp-3" style={{ color: '#b6c2cf' }}>
          {ticket.title}
        </p>

        {/* Description preview */}
        {ticket.description && (
          <p className="text-xs leading-relaxed line-clamp-2 mt-1" style={{ color: 'var(--text-muted)' }}>
            {ticket.description}
          </p>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-2.5 text-[11px]" style={{ color: '#8c9bab' }}>
          {/* Time since update */}
          <span className={clsx('inline-flex items-center gap-1 rounded px-1 py-0.5', isStale && 'text-red-400')}>
            {isStale ? <AlertCircle size={12} className="animate-pulse" /> : <Clock size={12} />}
            {time}
          </span>

          {/* Creation date */}
          <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 opacity-70">
            <Calendar size={10} />
            {createdLabel}
          </span>

          {/* Description indicator */}
          {ticket.description && <AlignLeft size={12} className="opacity-50" />}

          <span className="flex-1" />

          {/* Assignee */}
          {ticket.assignee ? (
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
              style={{ background: `hsl(${ticket.assignee.charCodeAt(0) * 37 % 360}, 50%, 42%)` }}
              title={ticket.assignee}
            >
              {ticket.assignee.charAt(0).toUpperCase()}
            </span>
          ) : (
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-40 transition-opacity shrink-0"
              style={{ border: '1.5px dashed var(--text-muted)' }}
            >
              <User size={10} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(Card)
