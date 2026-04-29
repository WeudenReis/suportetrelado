import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../lib/icons'
import type { BoardColumn } from '../../lib/boardColumns'
import type { TicketPriority, UserProfile } from '../../lib/supabase'

interface BulkActionsBarProps {
  selectedCount: number
  columns: BoardColumn[]
  members: UserProfile[]
  onMove: (columnId: string) => void
  onArchive: () => void
  onAssign: (assignee: string | null) => void
  onPriority: (priority: TicketPriority) => void
  onCancel: () => void
}

const PRIORITY_OPTS: { key: TicketPriority; label: string; color: string }[] = [
  { key: 'high',   label: 'Alta',  color: '#ef5c48' },
  { key: 'medium', label: 'Média', color: '#e2b203' },
  { key: 'low',    label: 'Baixa', color: '#4bce97' },
]

type Popover = null | 'priority' | 'assign'

export default function BulkActionsBar({
  selectedCount, columns, members,
  onMove, onArchive, onAssign, onPriority, onCancel,
}: BulkActionsBarProps) {
  const [popover, setPopover] = useState<Popover>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Fecha popover ao clicar fora
  useEffect(() => {
    if (!popover) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popover])

  const togglePopover = (p: Popover) => setPopover(prev => prev === p ? null : p)

  return (
    <motion.div
      ref={popoverRef}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
        zIndex: 90, display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 16,
        background: '#1a1f23', border: '1px solid rgba(37,208,102,0.2)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: '#25D066', marginRight: 4 }}>
        {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
      </span>
      <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

      {/* Mover para coluna */}
      <span style={{ fontSize: 11, fontWeight: 600, color: '#8C96A3', marginRight: 4 }}>Mover:</span>
      {columns.map(col => (
        <button
          key={col.id}
          onClick={() => onMove(col.id)}
          style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#B6C2CF', cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.12)'; e.currentTarget.style.borderColor = 'rgba(37,208,102,0.3)'; e.currentTarget.style.color = '#25D066' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#B6C2CF' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: col.dot_color }} />
          {col.title}
        </button>
      ))}

      <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

      {/* Prioridade */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => togglePopover('priority')}
          style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            background: popover === 'priority' ? 'rgba(226,178,3,0.18)' : 'rgba(226,178,3,0.08)',
            border: '1px solid rgba(226,178,3,0.2)',
            color: '#e2b203', cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          <Icon name="AlertTriangle" size={12} />
          Prioridade
          <Icon name="ChevronDown" size={10} style={{ opacity: 0.7 }} />
        </button>
        <AnimatePresence>
          {popover === 'priority' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.14 }}
              style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
                background: '#1a1f23', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: 4, display: 'flex', flexDirection: 'column',
                gap: 2, minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {PRIORITY_OPTS.map(p => (
                <button
                  key={p.key}
                  onClick={() => { onPriority(p.key); setPopover(null) }}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: 'none',
                    background: 'transparent', color: '#B6C2CF', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                    transition: 'background 0.12s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                  {p.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Responsável */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => togglePopover('assign')}
          style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            background: popover === 'assign' ? 'rgba(87,157,255,0.18)' : 'rgba(87,157,255,0.08)',
            border: '1px solid rgba(87,157,255,0.2)',
            color: '#579dff', cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          <Icon name="UserPlus" size={12} />
          Atribuir
          <Icon name="ChevronDown" size={10} style={{ opacity: 0.7 }} />
        </button>
        <AnimatePresence>
          {popover === 'assign' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.14 }}
              style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
                background: '#1a1f23', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: 4, display: 'flex', flexDirection: 'column',
                gap: 2, minWidth: 200, maxHeight: 280, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <button
                onClick={() => { onAssign(null); setPopover(null) }}
                style={{
                  padding: '6px 10px', borderRadius: 6, border: 'none',
                  background: 'transparent', color: '#8C96A3', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                  transition: 'background 0.12s', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#454F59', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="X" size={11} color="#8C96A3" />
                </span>
                Sem responsável
              </button>
              {members.length === 0 ? (
                <p style={{ padding: '8px 10px', fontSize: 11, color: '#596773', margin: 0 }}>Nenhum membro</p>
              ) : members.map(m => (
                <button
                  key={m.email}
                  onClick={() => { onAssign(m.email); setPopover(null) }}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: 'none',
                    background: 'transparent', color: '#B6C2CF', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500,
                    transition: 'background 0.12s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: m.avatar_color || '#579DFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: '#fff',
                  }}>
                    {(m.name || m.email).slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.email.split('@')[0]}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

      <button
        onClick={onArchive}
        style={{
          padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', cursor: 'pointer', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
      >
        <Icon name="Archive" size={12} />
        Arquivar
      </button>
      <button
        onClick={onCancel}
        style={{
          padding: '5px 8px', borderRadius: 8, border: 'none',
          background: 'transparent', color: '#596773', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#B6C2CF' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#596773' }}
      >
        <Icon name="X" size={14} />
      </button>
    </motion.div>
  )
}
