import { motion } from 'framer-motion'
import { Archive, X } from 'lucide-react'
import type { BoardColumn } from '../../lib/boardColumns'

interface BulkActionsBarProps {
  selectedCount: number
  columns: BoardColumn[]
  onMove: (columnId: string) => void
  onArchive: () => void
  onCancel: () => void
}

export default function BulkActionsBar({ selectedCount, columns, onMove, onArchive, onCancel }: BulkActionsBarProps) {
  return (
    <motion.div
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
      <span style={{ fontSize: 11, fontWeight: 600, color: '#8C96A3', marginRight: 4 }}>Mover para:</span>
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
        <Archive size={12} />
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
        <X size={14} />
      </button>
    </motion.div>
  )
}
