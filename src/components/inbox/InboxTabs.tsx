import { motion } from 'framer-motion'
import { Bell, Inbox, AtSign, CalendarIcon } from 'lucide-react'

export type TabFilter = 'all' | 'unread' | 'mentions' | 'planner'

interface TabDef {
  key: TabFilter
  label: string
  icon: React.ReactNode
  count: number
}

interface InboxTabsProps {
  active: TabFilter
  onChange: (tab: TabFilter) => void
  totalCount: number
  unreadCount: number
  mentionCount: number
  plannerCount: number
}

export default function InboxTabs({ active, onChange, totalCount, unreadCount, mentionCount, plannerCount }: InboxTabsProps) {
  const tabs: TabDef[] = [
    { key: 'all', label: 'Todas', icon: <Bell size={13} />, count: totalCount },
    { key: 'unread', label: 'Não lidas', icon: <Inbox size={13} />, count: unreadCount },
    { key: 'mentions', label: 'Menções', icon: <AtSign size={13} />, count: mentionCount },
    { key: 'planner', label: 'Datas', icon: <CalendarIcon size={13} />, count: plannerCount },
  ]

  return (
    <div className="hide-scrollbar" style={{
      display: 'flex', gap: 12, position: 'relative',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '0 20px', overflowX: 'auto', whiteSpace: 'nowrap'
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 4px 12px', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, position: 'relative',
              background: 'transparent',
              color: isActive ? '#25D066' : '#8C96A3',
              transition: 'color 0.2s',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 8,
                background: isActive ? 'rgba(37,208,102,0.15)' : 'rgba(255,255,255,0.06)',
                color: isActive ? '#25D066' : '#8C96A3',
                marginLeft: 2, lineHeight: '16px',
              }}>
                {tab.count > 99 ? '99+' : tab.count}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId="inbox-active-tab"
                style={{
                  position: 'absolute', bottom: -1, left: 0, right: 0,
                  height: 2, background: '#25D066', borderRadius: 1,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
