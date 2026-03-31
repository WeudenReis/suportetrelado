import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CheckCheck, Clock, AtSign, ArrowRight, MessageSquare, UserPlus, ChevronLeft, BellOff } from 'lucide-react'
import { useNotificationContext } from './NotificationContext'
import type { Notification } from '../lib/supabase'

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

function dateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const groups: Map<string, Notification[]> = new Map()
  for (const n of items) {
    const lbl = dateLabel(n.created_at)
    if (!groups.has(lbl)) groups.set(lbl, [])
    groups.get(lbl)!.push(n)
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

export default function InboxSidebar({ user, collapsed, onToggle, onOpenTicket }: InboxSidebarProps) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotificationContext()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications
  const grouped = useMemo(() => groupByDate(filtered), [filtered])

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
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[9px] font-bold flex items-center justify-center text-white px-0.5" style={{ background: '#ef5c48', boxShadow: '0 0 0 2px var(--bg-secondary)' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar-root h-full flex-shrink-0 relative z-30 flex" style={{ width: 340 }}>
      <div className="flex flex-col flex-1 overflow-hidden px-3 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-2 py-3 rounded-xl" style={{ background: 'rgba(87,157,255,0.06)', border: '1px solid rgba(87,157,255,0.10)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(87,157,255,0.18)' }}>
              <Inbox size={17} className="text-blue-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-bold leading-tight" style={{ color: '#ffffff' }}>Notificações</span>
              <span className="text-[10px] font-medium leading-tight mt-0.5" style={{ color: '#9fadbc' }}>
                {notifications.length === 0 ? 'Nenhuma notificação' : unreadCount > 0 ? `${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'} de ${notifications.length}` : `${notifications.length} ${notifications.length === 1 ? 'notificação' : 'notificações'}`}
              </span>
            </div>
          </div>
          <button onClick={onToggle} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: '#9fb0c2' }}>
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Tabs + mark all */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all"
              style={filter === 'all' ? { background: 'rgba(87,157,255,0.15)', color: '#579dff' } : { background: 'transparent', color: '#9fadbc' }}
            >Todas</button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all"
              style={filter === 'unread' ? { background: 'rgba(87,157,255,0.15)', color: '#579dff' } : { background: 'transparent', color: '#9fadbc' }}
            >Não lidas {unreadCount > 0 && <span className="ml-1 text-[9px] font-bold px-1 py-px rounded-full text-white" style={{ background: '#ef5c48' }}>{unreadCount}</span>}</button>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAll} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors" style={{ color: '#9fadbc' }}>
              <CheckCheck size={12} />
              Ler todas
            </button>
          )}
        </div>

        {/* List grouped by date */}
        <div className="flex-1 overflow-y-auto pr-1 inbox-scroll">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: '#596773' }}>
              <Clock size={22} className="animate-spin" />
              <span className="text-xs font-medium">Carregando notificações...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(87,157,255,0.08)' }}>
                {filter === 'unread' ? <BellOff size={24} style={{ color: '#596773' }} /> : <Inbox size={24} strokeWidth={1.2} style={{ color: '#596773' }} />}
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold mb-0.5" style={{ color: '#9fadbc' }}>
                  {filter === 'unread' ? 'Tudo lido!' : 'Nenhuma notificação'}
                </p>
                <p className="text-[10px]" style={{ color: '#596773' }}>
                  {filter === 'unread' ? 'Você não tem notificações pendentes' : 'Quando alguém te mencionar ou vincular, aparecerá aqui'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {grouped.map(group => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 px-1 py-1.5" style={{ background: 'var(--bg-secondary)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#596773' }}>{group.label}</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {group.items.map(notif => {
                      const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.comment
                      return (
                        <motion.div
                          key={notif.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          onClick={() => handleClick(notif)}
                          className="inbox-notif-item flex items-start gap-2.5 px-2.5 py-3 rounded-lg cursor-pointer transition-all"
                          style={{
                            background: !notif.is_read ? 'rgba(87,157,255,0.06)' : 'transparent',
                            borderLeft: !notif.is_read ? '2px solid #579dff' : '2px solid transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = !notif.is_read ? 'rgba(87,157,255,0.10)' : 'rgba(255,255,255,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = !notif.is_read ? 'rgba(87,157,255,0.06)' : 'transparent')}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${config.color}15`, color: config.color }}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[12px] font-bold truncate" style={{ color: !notif.is_read ? '#ffffff' : '#dfe1e6' }}>{notif.sender_name}</span>
                              <span className="text-[9px] font-semibold px-1.5 py-px rounded-full" style={{ background: `${config.color}18`, color: config.color }}>{config.label}</span>
                            </div>
                            <p className="text-[11px] leading-snug m-0 overflow-hidden" style={{
                              color: !notif.is_read ? '#b6c2cf' : '#8c9bab',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              textOverflow: 'ellipsis',
                            }}>{notif.message}</p>
                            {notif.ticket_title && (
                              <span className="text-[10px] mt-1 inline-flex items-center gap-1 truncate max-w-full" style={{ color: '#596773' }}>
                                <CreditCardIcon /> {notif.ticket_title}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-0.5">
                            <span className="text-[10px] font-medium" style={{ color: '#596773' }}>{timeAgo(notif.created_at)}</span>
                            {!notif.is_read && (
                              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#579dff' }} />
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CreditCardIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}
