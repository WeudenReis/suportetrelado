import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CheckCheck, Clock, AtSign, ArrowRight, MessageSquare, UserPlus, ChevronLeft } from 'lucide-react'
import { useNotificationContext } from './NotificationContext'

interface InboxSidebarProps {
  user: string
  collapsed: boolean
  onToggle: () => void
  onOpenTicket?: (ticketId: string) => void
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  mention:     { icon: <AtSign size={14} />,        color: '#579dff', label: 'Menção' },
  comment:     { icon: <MessageSquare size={14} />,  color: '#4bce97', label: 'Comentário' },
  assignment:  { icon: <UserPlus size={14} />,       color: '#f5a623', label: 'Atribuição' },
  move:        { icon: <ArrowRight size={14} />,     color: '#a855f7', label: 'Movido' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  if (hrs < 24) return `${hrs}h`
  if (days === 1) return 'ontem'
  return `${days}d`
}

export default function InboxSidebar({ user, collapsed, onToggle, onOpenTicket }: InboxSidebarProps) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotificationContext()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications

  const handleClick = async (notif: { id: string; is_read: boolean; ticket_id?: string | null }) => {
    if (!notif.is_read) {
      await markRead(notif.id)
    }
    if (notif.ticket_id && onOpenTicket) {
      onOpenTicket(notif.ticket_id)
    }
  }

  const handleMarkAll = async () => {
    await markAllRead()
  }

  if (collapsed) {
    return (
      <div className="sidebar-root sidebar-root--collapsed h-full flex-shrink-0 relative z-30" style={{ width: 52 }}>
        <div className="flex flex-col items-center pt-4 gap-3">
          <button onClick={onToggle} className="w-8 h-8 rounded-lg flex items-center justify-center relative" style={{ background: 'rgba(87,157,255,0.15)' }}>
            <Inbox size={16} className="text-blue-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: '#ef5c48' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar-root h-full flex-shrink-0 relative z-30 flex" style={{ width: 320 }}>
      <div className="flex flex-col flex-1 overflow-hidden px-3 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(87,157,255,0.16)' }}>
              <Inbox size={15} className="text-blue-300" />
            </div>
            <span className="text-lg font-bold truncate" style={{ color: '#ffffff' }}>Caixa de Entrada</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: '#ef5c48' }}>
                {unreadCount}
              </span>
            )}
          </div>
          <button onClick={onToggle} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: '#9fb0c2' }}>
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Tabs + mark all */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors"
              style={filter === 'all' ? { background: 'rgba(87,157,255,0.12)', color: '#579dff' } : { background: 'transparent', color: '#9fadbc' }}
            >Todas</button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors"
              style={filter === 'unread' ? { background: 'rgba(87,157,255,0.12)', color: '#579dff' } : { background: 'transparent', color: '#9fadbc' }}
            >Não lidas</button>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAll} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md hover:bg-white/10 transition-colors" style={{ color: '#9fadbc' }}>
              <CheckCheck size={12} />
              Ler todas
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: '#6b7280' }}>
              <Clock size={18} className="animate-spin" />
              <span className="text-xs">Carregando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: '#6b7280' }}>
              <Inbox size={28} strokeWidth={1.2} />
              <span className="text-xs">{filter === 'unread' ? 'Nenhuma não lida' : 'Nenhuma notificação'}</span>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map(notif => {
                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.comment
                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    onClick={() => handleClick(notif)}
                    className="flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors"
                    style={{
                      background: !notif.is_read ? 'rgba(87,157,255,0.06)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = !notif.is_read ? 'rgba(87,157,255,0.10)' : 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = !notif.is_read ? 'rgba(87,157,255,0.06)' : 'transparent')}
                  >
                    <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${config.color}18`, color: config.color }}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[12px] font-semibold truncate" style={{ color: '#dfe1e6' }}>{notif.sender_name}</span>
                        <span className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</span>
                      </div>
                      <p className="text-[11px] leading-snug m-0 overflow-hidden" style={{
                        color: '#9fadbc',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textOverflow: 'ellipsis',
                      }}>{notif.message}</p>
                      {notif.ticket_title && (
                        <span className="text-[10px] mt-1 inline-block truncate max-w-full" style={{ color: '#596773' }}>#{notif.ticket_title}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 mt-0.5">
                      <span className="text-[10px]" style={{ color: '#596773' }}>{timeAgo(notif.created_at)}</span>
                      {!notif.is_read && <span className="w-2 h-2 rounded-full" style={{ background: '#579dff' }} />}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
