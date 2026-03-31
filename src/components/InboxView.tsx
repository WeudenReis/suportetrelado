import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, CheckCheck, Clock, AtSign, ArrowRight,
  MessageSquare, UserPlus, ChevronLeft, CheckCircle2,
  Check, ExternalLink, Ticket
} from 'lucide-react'
import { useNotificationContext } from './NotificationContext'
import type { Notification } from '../lib/supabase'

interface InboxSidebarProps {
  user: string
  collapsed: boolean
  onToggle: () => void
  onOpenTicket?: (ticketId: string) => void
}

type FilterType = 'all' | 'unread' | 'mentions'

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  mention:    { icon: <AtSign size={14} />,        color: '#3B82F6', label: 'Menção' },
  assignment: { icon: <UserPlus size={14} />,      color: '#10B981', label: 'Atribuição' },
  comment:    { icon: <MessageSquare size={14} />, color: '#F59E0B', label: 'Comentário' },
  move:       { icon: <ArrowRight size={14} />,    color: '#8B5CF6', label: 'Movido' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  if (hrs < 24) return `${hrs}h`
  if (days === 1) return 'ontem'
  if (days < 7) return `${days}d`
  if (days < 14) return 'sem passada'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatFullDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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

/* ── Animation variants ── */
const panelVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
}

const listVariants = {
  visible: { transition: { staggerChildren: 0.03 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
}

/* ── Component ── */
export default function InboxSidebar({ user, collapsed, onToggle, onOpenTicket }: InboxSidebarProps) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotificationContext()
  const [filter, setFilter] = useState<FilterType>('all')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.is_read)
    if (filter === 'mentions') return notifications.filter(n => n.type === 'mention')
    return notifications
  }, [notifications, filter])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  const handleMarkRead = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await markRead(id)
  }, [markRead])

  const handleOpen = useCallback(async (e: React.MouseEvent, notif: Notification) => {
    e.stopPropagation()
    if (!notif.is_read) await markRead(notif.id)
    if (notif.ticket_id && onOpenTicket) onOpenTicket(notif.ticket_id)
  }, [markRead, onOpenTicket])

  const handleItemClick = useCallback(async (notif: Notification) => {
    if (!notif.is_read) await markRead(notif.id)
    if (notif.ticket_id && onOpenTicket) onOpenTicket(notif.ticket_id)
  }, [markRead, onOpenTicket])

  const handleMarkAll = useCallback(async () => {
    await markAllRead()
  }, [markAllRead])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 8)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  /* ── Collapsed state ── */
  if (collapsed) {
    return (
      <div className="sidebar-root sidebar-root--collapsed h-full flex-shrink-0 relative z-30" style={{ width: 52 }}>
        <div className="flex flex-col items-center pt-4 gap-3">
          <button onClick={onToggle} className="inbox-collapsed-btn" title="Caixa de Entrada">
            <Inbox size={16} />
            {unreadCount > 0 && (
              <span className="inbox-collapsed-badge inbox-badge-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    )
  }

  /* ── Empty state helper ── */
  const renderEmpty = () => {
    const states: Record<FilterType, { icon: React.ReactNode; title: string; desc: string }> = {
      all: {
        icon: <Inbox size={28} strokeWidth={1.2} />,
        title: 'Nenhuma notificação',
        desc: 'As notificações aparecerão aqui',
      },
      unread: {
        icon: <CheckCircle2 size={28} strokeWidth={1.5} />,
        title: 'Tudo em dia!',
        desc: 'Nenhuma pendência',
      },
      mentions: {
        icon: <AtSign size={28} strokeWidth={1.5} />,
        title: 'Sem menções',
        desc: 'Quando alguém te @mencionar, aparecerá aqui',
      },
    }
    const s = states[filter]
    return (
      <motion.div
        className="inbox-empty"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        <div className="inbox-empty__icon">{s.icon}</div>
        <p className="inbox-empty__title">{s.title}</p>
        <p className="inbox-empty__desc">{s.desc}</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="sidebar-root h-full flex-shrink-0 relative z-30 flex"
      style={{ width: 340 }}
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="inbox-view">
        {/* ── Header ── */}
        <div className="inbox-header">
          <div className="inbox-header__top">
            <div className="inbox-header__title-group">
              <div className="inbox-header__icon-wrap">
                <Inbox size={17} />
              </div>
              <h2 className="inbox-header__title">Caixa de Entrada</h2>
            </div>
            <div className="inbox-header__right">
              {unreadCount > 0 && (
                <span className="inbox-header__count">
                  <span className="inbox-header__count-dot" />
                  {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
                </span>
              )}
              <button onClick={onToggle} className="inbox-header__close" title="Fechar painel">
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>

          {/* ── Tabs + Mark all ── */}
          <div className="inbox-tabs-row">
            <div className="inbox-tabs">
              {(['all', 'unread', 'mentions'] as FilterType[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`inbox-tabs__btn ${filter === f ? 'inbox-tabs__btn--active' : ''}`}
                >
                  {f === 'all' && 'Todas'}
                  {f === 'unread' && 'Não lidas'}
                  {f === 'mentions' && 'Menções'}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAll} className="inbox-mark-all" title="Marcar todas como lidas">
                <CheckCheck size={12} />
                Ler todas
              </button>
            )}
          </div>
        </div>

        <div className="inbox-separator" />

        {/* ── List ── */}
        <div
          ref={scrollRef}
          className={`inbox-scroll-container ${scrolled ? 'inbox-scroll-container--scrolled' : ''}`}
        >
          {loading ? (
            <div className="inbox-loading">
              <Clock size={22} className="animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : filtered.length === 0 ? (
            renderEmpty()
          ) : (
            <motion.div className="inbox-list" variants={listVariants} initial="hidden" animate="visible">
              {grouped.map(group => (
                <div key={group.label} className="inbox-group">
                  <div className="inbox-group__label">
                    <span>{group.label}</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {group.items.map(notif => {
                      const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.comment
                      const isUnread = !notif.is_read
                      return (
                        <motion.div
                          key={notif.id}
                          variants={itemVariants}
                          exit="exit"
                          layout
                          onClick={() => handleItemClick(notif)}
                          className={`inbox-item ${isUnread ? 'inbox-item--unread' : 'inbox-item--read'}`}
                          style={{ borderLeftColor: isUnread ? config.color : 'transparent' }}
                        >
                          {/* Icon */}
                          <div
                            className="inbox-item__icon"
                            style={{ background: `${config.color}18`, color: config.color }}
                          >
                            {config.icon}
                          </div>

                          {/* Content */}
                          <div className="inbox-item__content">
                            <div className="inbox-item__top">
                              <span className="inbox-item__sender">{notif.sender_name}</span>
                              <span
                                className="inbox-item__type"
                                style={{ background: `${config.color}18`, color: config.color }}
                              >
                                {config.label}
                              </span>
                            </div>
                            <p className="inbox-item__message">{notif.message}</p>
                            {notif.ticket_title && (
                              <span className="inbox-item__ticket">
                                <Ticket size={10} /> {notif.ticket_title}
                              </span>
                            )}
                          </div>

                          {/* Meta */}
                          <div className="inbox-item__meta">
                            <span className="inbox-item__time" title={formatFullDate(notif.created_at)}>
                              {timeAgo(notif.created_at)}
                            </span>
                            {isUnread && <span className="inbox-item__dot" />}
                          </div>

                          {/* Hover actions */}
                          <div className="inbox-item__actions">
                            {isUnread && (
                              <button
                                className="inbox-item__action-btn"
                                title="Marcar como lida"
                                onClick={(e) => handleMarkRead(e, notif.id)}
                              >
                                <Check size={13} />
                              </button>
                            )}
                            {notif.ticket_id && (
                              <button
                                className="inbox-item__action-btn"
                                title="Abrir cartão"
                                onClick={(e) => handleOpen(e, notif)}
                              >
                                <ExternalLink size={13} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
