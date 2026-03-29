import { Inbox, Calendar, LayoutGrid } from 'lucide-react'

type NavTab = 'inbox' | 'planner' | 'board'

interface BottomBarProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const NAV_ITEMS = [
  { id: 'inbox',   label: 'Caixa de entrada', icon: <Inbox size={18} strokeWidth={1.6} /> },
  { id: 'planner', label: 'Planejador',      icon: <Calendar size={18} strokeWidth={1.6} /> },
  { id: 'board',   label: 'Quadro',          icon: <LayoutGrid size={18} strokeWidth={1.6} /> },
]

export default function BottomBar({ active, onChange }: BottomBarProps) {
  return (
    <div className="bottom-bar-outer">
      <nav className="bottom-bar">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onChange(item.id as NavTab)}
            className={`nav-item${active === item.id ? ' nav-item-active' : ''}`}
            type="button"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
