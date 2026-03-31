import { Inbox, Calendar, LayoutGrid } from 'lucide-react'
import { useNotificationContext } from './NotificationContext'

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
  const { unreadCount } = useNotificationContext()

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
            <span className="relative inline-flex">
              {item.icon}
              {item.id === 'inbox' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white px-1" style={{ background: '#ef5c48' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
