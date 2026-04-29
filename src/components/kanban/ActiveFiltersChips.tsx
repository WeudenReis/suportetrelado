import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ActiveFiltersChipsProps {
  filterPriority: string
  filterAssignee: string
  filterLabel: string
  uniqueAssignees: { value: string; label: string }[]
  onClearPriority: () => void
  onClearAssignee: () => void
  onClearLabel: () => void
  onClearAll: () => void
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

function Chip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 4px 4px 10px',
        borderRadius: 999,
        background: 'rgba(37,208,102,0.08)',
        border: '1px solid rgba(37,208,102,0.24)',
        color: '#B6C2CF',
        fontSize: 11.5, fontWeight: 500,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <span style={{ color: '#8C96A3' }}>{label}:</span>
      <span style={{ color: '#E6E5E8', fontWeight: 600 }}>{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remover filtro ${label}`}
        style={{
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          color: '#8C96A3',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = '#ef4444' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#8C96A3' }}
      >
        <X size={10} />
      </button>
    </motion.span>
  )
}

export default function ActiveFiltersChips({
  filterPriority, filterAssignee, filterLabel,
  uniqueAssignees,
  onClearPriority, onClearAssignee, onClearLabel, onClearAll,
}: ActiveFiltersChipsProps) {
  const items: React.ReactNode[] = []

  if (filterPriority !== 'all') {
    items.push(
      <Chip
        key="prio"
        label="Prioridade"
        value={PRIORITY_LABELS[filterPriority] ?? filterPriority}
        onClear={onClearPriority}
      />
    )
  }
  if (filterAssignee !== 'all') {
    const value = filterAssignee === '__none__'
      ? 'Sem responsável'
      : uniqueAssignees.find(a => a.value === filterAssignee)?.label ?? filterAssignee
    items.push(
      <Chip
        key="assignee"
        label="Responsável"
        value={value}
        onClear={onClearAssignee}
      />
    )
  }
  if (filterLabel !== 'all') {
    const name = filterLabel.includes('|') ? filterLabel.split('|')[0] : filterLabel
    items.push(
      <Chip
        key="label"
        label="Etiqueta"
        value={name}
        onClear={onClearLabel}
      />
    )
  }

  if (items.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '6px 16px 8px',
        background: 'rgba(34,39,43,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
      }}
    >
      {items}
      {items.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          style={{
            marginLeft: 4,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#8C96A3',
            fontSize: 11.5, fontWeight: 500,
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8C96A3'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
        >
          Limpar tudo
        </button>
      )}
    </motion.div>
  )
}
