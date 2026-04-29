import { Filter, X } from 'lucide-react'

interface FilterPopoverContentProps {
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
}

const selectArrow = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2325D066' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")"

function selectStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 28px 8px 10px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 500,
    background: active ? 'rgba(37,208,102,0.08)' : '#1d2125',
    border: active ? '1px solid rgba(37,208,102,0.32)' : '1px solid rgba(255,255,255,0.08)',
    color: '#E6E5E8',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
    appearance: 'none',
    backgroundImage: selectArrow,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#8C96A3',
      marginBottom: 6,
    }}>{children}</label>
  )
}

export default function FilterPopoverContent({
  filterPriority, filterAssignee, filterLabel,
  uniqueAssignees, uniqueLabels, activeFilterCount,
  onFilterPriorityChange, onFilterAssigneeChange, onFilterLabelChange,
  onClearAllFilters,
}: FilterPopoverContentProps) {
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#25D066', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          <Filter size={13} /> Filtros
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearAllFilters}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 6,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <X size={11} /> Limpar
          </button>
        )}
      </header>

      <div>
        <FieldLabel>Prioridade</FieldLabel>
        <select
          value={filterPriority}
          onChange={e => onFilterPriorityChange(e.target.value)}
          style={selectStyle(filterPriority !== 'all')}
        >
          <option value="all">Todas</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
      </div>

      <div>
        <FieldLabel>Responsável</FieldLabel>
        <select
          value={filterAssignee}
          onChange={e => onFilterAssigneeChange(e.target.value)}
          style={selectStyle(filterAssignee !== 'all')}
        >
          <option value="all">Todos</option>
          <option value="__none__">Sem responsável</option>
          {uniqueAssignees.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      <div>
        <FieldLabel>Etiqueta</FieldLabel>
        <select
          value={filterLabel}
          onChange={e => onFilterLabelChange(e.target.value)}
          style={selectStyle(filterLabel !== 'all')}
        >
          <option value="all">Todas</option>
          {uniqueLabels.map(l => {
            const name = l.includes('|') ? l.split('|')[0] : l
            return <option key={l} value={l}>{name}</option>
          })}
        </select>
      </div>
    </div>
  )
}
