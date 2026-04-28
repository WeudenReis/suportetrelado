import { motion } from 'framer-motion'
import { LayoutGrid, Table2, CalendarDays, GanttChart, BarChart3 } from 'lucide-react'

export type WorkView = 'board' | 'table' | 'calendar' | 'timeline' | 'dashboard'

interface ViewItem {
  id: WorkView
  label: string
  icon: React.ReactNode
  enabled: boolean
}

const VIEWS: ViewItem[] = [
  { id: 'board',     label: 'Quadro',     icon: <LayoutGrid size={15} strokeWidth={1.8} />, enabled: true  },
  { id: 'table',     label: 'Tabela',     icon: <Table2 size={15} strokeWidth={1.8} />,     enabled: true  },
  { id: 'calendar',  label: 'Calendário', icon: <CalendarDays size={15} strokeWidth={1.8} />, enabled: false },
  { id: 'timeline',  label: 'Cronograma', icon: <GanttChart size={15} strokeWidth={1.8} />, enabled: false },
  { id: 'dashboard', label: 'Dashboard',  icon: <BarChart3 size={15} strokeWidth={1.8} />,  enabled: false },
]

interface ViewSwitcherProps {
  active: WorkView
  onChange: (view: WorkView) => void
}

export default function ViewSwitcher({ active, onChange }: ViewSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Selecionar visualização"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(34,39,43,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        flexShrink: 0,
        position: 'relative',
        zIndex: 5,
      }}
    >
      {VIEWS.map(view => {
        const isActive = active === view.id
        const isDisabled = !view.enabled
        return (
          <button
            key={view.id}
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(view.id)}
            title={isDisabled ? 'Em breve' : view.label}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: isDisabled ? '#3B4754' : isActive ? '#E5E7EB' : '#8C96A3',
              fontSize: 12.5,
              fontWeight: isActive ? 700 : 500,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { if (!isDisabled && !isActive) e.currentTarget.style.color = '#b6c2cf' }}
            onMouseLeave={e => { if (!isDisabled && !isActive) e.currentTarget.style.color = '#8C96A3' }}
          >
            {isActive && (
              <motion.span
                layoutId="view-switcher-active"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  background: 'rgba(37,208,102,0.12)',
                  border: '1px solid rgba(37,208,102,0.25)',
                  zIndex: -1,
                }}
              />
            )}
            <span style={{ display: 'inline-flex', color: isActive ? '#25D066' : 'inherit' }}>
              {view.icon}
            </span>
            <span>{view.label}</span>
            {isDisabled && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.05em',
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                color: '#596773',
                marginLeft: 2,
                textTransform: 'uppercase',
              }}>
                Em breve
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
