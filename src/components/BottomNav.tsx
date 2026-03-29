import { Inbox, CalendarDays, Columns3 } from 'lucide-react'

type NavTab = 'inbox' | 'planner' | 'board'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const TABS: { id: NavTab; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox',   label: 'Caixa de entrada', icon: Inbox },
  { id: 'planner', label: 'Planejador',       icon: CalendarDays },
  { id: 'board',   label: 'Quadro',           icon: Columns3 },
]

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <div className="bottom-nav-wrapper">
      <nav className="bottom-nav">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
              style={{ color: isActive ? '#579dff' : '#8c9bab' }}
            >
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
