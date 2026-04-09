import { useCallback, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import Card from '../Card'
import type { Ticket } from '../../lib/supabase'

// ── DroppableColumn ─────────────────────────────────────────
export function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} className={clsx('flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-lg transition-all duration-200', isOver && 'ring-1 ring-blue-500/30 bg-blue-500/[0.04]')}>{children}</div>
}

// ── SortableCard ────────────────────────────────────────────
interface SortableCardProps {
  ticket: Ticket
  onClick: (ticket: Ticket) => void
  onUpdate: (u: Ticket) => void
  onArchive: (id: string) => void
  onShowToast?: (msg: string, type: 'ok' | 'err') => void
  isOverCard: boolean
  activeTicket: Ticket | null
  compact?: boolean
  bulkMode?: boolean
  isSelected?: boolean
  onBulkToggle?: (id: string) => void
  isMutating?: boolean
}

function SortableCardInner({ ticket, onClick, onUpdate, onArchive, onShowToast, isOverCard, activeTicket, compact, bulkMode, isSelected, onBulkToggle, isMutating }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: { type: 'card', ticket },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const handleClick = useCallback(() => {
    if (bulkMode && onBulkToggle) {
      onBulkToggle(ticket.id)
    } else {
      onClick(ticket)
    }
  }, [onClick, ticket, bulkMode, onBulkToggle])

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{
      ...style,
      ...(bulkMode && isSelected ? { outline: '2px solid #25D066', outlineOffset: -2, borderRadius: 10 } : {}),
    }}>
      {activeTicket && isOverCard && activeTicket.id !== ticket.id && (
        <div className="dnd-drop-indicator" />
      )}
      <Card
        card={ticket}
        onClick={handleClick}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onShowToast={onShowToast}
        isDragging={isDragging}
        compact={compact}
        isMutating={isMutating}
      />
    </div>
  )
}

export const SortableCard = memo(SortableCardInner)

// ── SortableBoardColumn ─────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SortableBoardColumn({ id, accentColor, children }: { id: string; accentColor?: string; children: (drag: { attributes: any; listeners: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'column', columnId: id } })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(accentColor ? { '--col-accent': accentColor } as React.CSSProperties : {}),
  }

  return (
    <div ref={setNodeRef} style={style} className={clsx('trello-col group', isDragging && 'trello-col--drag')}>
      {children({ attributes, listeners, isDragging })}
    </div>
  )
}
