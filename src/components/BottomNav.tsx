import { Inbox, Calendar, Megaphone, Link2, BarChart3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotificationContext } from './useNotificationContext'
import { useAnnouncementContext } from './useAnnouncementContext'

type NavTab = 'inbox' | 'planner' | 'board' | 'announcements' | 'links' | 'dashboard'

interface BottomBarProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const NAV_ITEMS = [
  { id: 'inbox',         label: 'Caixa de entrada', icon: <Inbox size={18} strokeWidth={1.6} /> },
  { id: 'planner',       label: 'Planejador',       icon: <Calendar size={18} strokeWidth={1.6} /> },
  { id: 'announcements', label: 'Avisos',           icon: <Megaphone size={18} strokeWidth={1.6} /> },
  { id: 'links',         label: 'Links',            icon: <Link2 size={18} strokeWidth={1.6} /> },
  { id: 'dashboard',     label: 'Dashboard',        icon: <BarChart3 size={18} strokeWidth={1.6} /> },
]

export default function BottomBar({ active, onChange }: BottomBarProps) {
  const { unreadCount } = useNotificationContext()
  const { announcements } = useAnnouncementContext()

  const criticalCount = announcements.filter(a => a.severity === 'critical').length
  const announcementBadge = announcements.length
  const announcementBadgeColor = criticalCount > 0 ? '#ef5c48' : '#F5A623'

  return (
    <div className="bottom-bar-outer">
      <nav className="bottom-bar" role="navigation" aria-label="Navegação principal" data-tour="bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onChange(item.id as NavTab)}
            className={`nav-item${active === item.id ? ' nav-item-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            aria-label={item.label}
          >
            <span className="relative inline-flex">
              {item.icon}
              <AnimatePresence>
                {item.id === 'inbox' && unreadCount > 0 && (
                  <motion.span
                    key="inbox-badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white px-1 inbox-badge-pulse"
                    style={{ background: '#25D066' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                )}
                {item.id === 'announcements' && announcementBadge > 0 && (
                  <motion.span
                    key="ann-badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white px-1"
                    style={{ background: announcementBadgeColor, boxShadow: `0 0 6px ${announcementBadgeColor}80` }}
                  >
                    {announcementBadge > 99 ? '99+' : announcementBadge}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
