import { motion } from 'framer-motion'
import { Filter, X } from 'lucide-react'

interface FilterPanelProps {
  filterPriority: string
  filterAssignee: string
  filterLabel: string
  uniqueAssignees: { value: string; label: string }[]
  uniqueLabels: string[]
  activeFilterCount: number
  onFilterPriorityChange: (value: string) => void
  onFilterAssigneeChange: (value: string) => void
  onFilterLabelChange: (value: string) => void
  onClearAllFilters: () => void
  onClose: () => void
}

const selectArrow = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2325D066' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")"

function filterSelectStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '6px 28px 6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    background: isActive ? 'rgba(37,208,102,0.1)' : '#22272b',
    border: isActive ? '1px solid rgba(37,208,102,0.3)' : '1px solid rgba(255,255,255,0.08)',
    color: '#B6C2CF', outline: 'none', cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
    appearance: 'none' as const,
    backgroundImage: selectArrow,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  }
}

export default function FilterPanel({
  filterPriority, filterAssignee, filterLabel,
  uniqueAssignees, uniqueLabels, activeFilterCount,
  onFilterPriorityChange, onFilterAssigneeChange, onFilterLabelChange,
  onClearAllFilters, onClose,
}: FilterPanelProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      style={{ overflow: 'hidden', background: '#1a1f23', borderBottom: '1px solid rgba(37,208,102,0.1)' }}
      role="region"
      aria-label="Filtros"
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        fontFamily: "'Space Grotesk', sans-serif", flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} style={{ color: '#25D066' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#25D066', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filtros</span>
        </div>

        <select value={filterPriority} onChange={e => onFilterPriorityChange(e.target.value)} style={filterSelectStyle(filterPriority !== 'all')}>
          <option value="all">Prioridade</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>

        <select value={filterAssignee} onChange={e => onFilterAssigneeChange(e.target.value)} style={{ ...filterSelectStyle(filterAssignee !== 'all'), maxWidth: 180 }}>
          <option value="all">Responsável</option>
          <option value="__none__">Sem responsável</option>
          {uniqueAssignees.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>

        <select value={filterLabel} onChange={e => onFilterLabelChange(e.target.value)} style={{ ...filterSelectStyle(filterLabel !== 'all'), maxWidth: 180 }}>
          <option value="all">Etiqueta</option>
          {uniqueLabels.map(l => {
            const name = l.includes('|') ? l.split('|')[0] : l
            return <option key={l} value={l}>{name}</option>
          })}
        </select>

        {activeFilterCount > 0 && (
          <button onClick={onClearAllFilters}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
              display: 'flex', alignItems: 'center', gap: 4, transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
          >
            <X size={11} /> Limpar filtros ({activeFilterCount})
          </button>
        )}

        <span style={{ flex: 1 }} />
        <button onClick={onClose}
          style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: '#596773', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  )
}
