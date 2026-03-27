import { motion } from 'framer-motion'
import { Inbox, CalendarDays, Columns3, ArrowRightLeft } from 'lucide-react'

type NavTab = 'inbox' | 'planner' | 'board' | 'switch'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const TABS: { id: NavTab; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox',   label: 'Caixa de entrada', icon: Inbox },
  { id: 'planner', label: 'Planejador',       icon: CalendarDays },
  { id: 'board',   label: 'Quadro',           icon: Columns3 },
  { id: 'switch',  label: 'Mudar de quadros', icon: ArrowRightLeft },
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
              className="bottom-nav__item"
              style={{ color: isActive ? '#60a5fa' : 'var(--text-muted)' }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[11px] font-medium mt-0.5">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="bottom-nav__indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
