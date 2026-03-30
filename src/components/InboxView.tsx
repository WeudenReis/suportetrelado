import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CheckCheck, Clock, AtSign, ArrowRight, MessageSquare, UserPlus } from 'lucide-react'
import { supabase, fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/supabase'
import type { Notification } from '../lib/supabase'

interface InboxViewProps {
  user: string
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

export default function InboxView({ user, onOpenTicket }: InboxViewProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await fetchNotifications(user)
    setNotifications(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        const notif = payload.new as Notification
        if (notif.recipient_email === user) {
          setNotifications(prev => [notif, ...prev])
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => {
        setNotifications(prev => prev.map(n => n.id === (payload.new as Notification).id ? payload.new as Notification : n))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load, user])

  const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications
  const unreadCount = notifications.filter(n => !n.is_read).length

  const handleClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    }
    if (notif.ticket_id && onOpenTicket) {
      onOpenTicket(notif.ticket_id)
    }
  }

  const handleMarkAll = async () => {
    await markAllNotificationsRead(user)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <div className="inbox-view">
      <div className="inbox-view__header">
        <div className="inbox-view__title-row">
          <Inbox size={20} />
          <h2 className="inbox-view__title">Caixa de Entrada</h2>
          {unreadCount > 0 && (
            <span className="inbox-view__badge">{unreadCount}</span>
          )}
        </div>
        <div className="inbox-view__actions">
          <div className="inbox-view__tabs">
            <button
              type="button"
              className={`inbox-view__tab ${filter === 'all' ? 'inbox-view__tab--active' : ''}`}
              onClick={() => setFilter('all')}
            >Todas</button>
            <button
              type="button"
              className={`inbox-view__tab ${filter === 'unread' ? 'inbox-view__tab--active' : ''}`}
              onClick={() => setFilter('unread')}
            >Não lidas</button>
          </div>
          {unreadCount > 0 && (
            <button type="button" className="inbox-view__mark-all" onClick={handleMarkAll}>
              <CheckCheck size={14} />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      <div className="inbox-view__list">
        {loading ? (
          <div className="inbox-view__empty">
            <Clock size={20} className="animate-spin" />
            <span>Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="inbox-view__empty">
            <Inbox size={32} strokeWidth={1.2} />
            <span>{filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map(notif => {
              const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.comment
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`inbox-item ${!notif.is_read ? 'inbox-item--unread' : ''}`}
                  onClick={() => handleClick(notif)}
                >
                  <div className="inbox-item__icon" style={{ background: `${config.color}20`, color: config.color }}>
                    {config.icon}
                  </div>
                  <div className="inbox-item__content">
                    <div className="inbox-item__top">
                      <span className="inbox-item__sender">{notif.sender_name}</span>
                      <span className="inbox-item__type" style={{ color: config.color }}>{config.label}</span>
                    </div>
                    <p className="inbox-item__message">{notif.message}</p>
                    {notif.ticket_title && (
                      <span className="inbox-item__ticket">#{notif.ticket_title}</span>
                    )}
                  </div>
                  <div className="inbox-item__meta">
                    <span className="inbox-item__time">{timeAgo(notif.created_at)}</span>
                    {!notif.is_read && <span className="inbox-item__dot" />}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
