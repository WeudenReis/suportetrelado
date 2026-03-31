import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, CheckCheck, Clock, AtSign, ArrowRight,
  MessageSquare, UserPlus, ChevronLeft, CheckCircle2,
  Check, ExternalLink, Ticket, Bell, BellOff
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

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  mention:    { icon: <AtSign size={15} />,        color: '#3B82F6', bgColor: 'rgba(59,130,246,0.12)', label: 'Menção' },
  assignment: { icon: <UserPlus size={15} />,      color: '#10B981', bgColor: 'rgba(16,185,129,0.12)', label: 'Atribuição' },
  comment:    { icon: <MessageSquare size={15} />, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.12)', label: 'Comentário' },
  move:       { icon: <ArrowRight size={15} />,    color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.12)', label: 'Movido' },
}

const FILTER_ICONS: Record<FilterType, React.ReactNode> = {
  all:      <Bell size={13} />,
  unread:   <Inbox size={13} />,
  mentions: <AtSign size={13} />,
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'Todas',
  unread: 'Não lidas',
  mentions: 'Menções',
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
const listVariants = {
  visible: { transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, x: -30, transition: { duration: 0.2 } },
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
        icon: <BellOff size={40} strokeWidth={1.2} />,
        title: 'Nenhuma notificação',
        desc: 'Quando alguém te mencionar ou vincular a um cartão, a notificação aparecerá aqui.',
      },
      unread: {
        icon: <CheckCircle2 size={40} strokeWidth={1.5} />,
        title: 'Tudo em dia!',
        desc: 'Você não tem notificações pendentes.',
      },
      mentions: {
        icon: <AtSign size={40} strokeWidth={1.5} />,
        title: 'Sem menções',
        desc: 'Quando alguém te @mencionar em um comentário, aparecerá aqui.',
      },
    }
    const s = states[filter]
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px 32px', textAlign: 'center', gap: 16,
        }}
      >
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(87,157,255,0.08) 0%, rgba(139,92,246,0.08) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#596773', marginBottom: 4,
        }}>
          {s.icon}
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#b6c2cf', margin: 0 }}>{s.title}</p>
        <p style={{ fontSize: 12, color: '#596773', margin: 0, maxWidth: 220, lineHeight: 1.5 }}>{s.desc}</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="sidebar-root h-full flex-shrink-0 relative z-30 flex"
      style={{ width: 360 }}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

        {/* ══════ HEADER COM GRADIENTE ══════ */}
        <div style={{
          padding: '20px 20px 0',
          background: 'linear-gradient(180deg, rgba(87,157,255,0.06) 0%, transparent 100%)',
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
              }}>
                <Inbox size={18} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
                  Caixa de Entrada
                </h2>
                <p style={{ fontSize: 11, color: '#9fadbc', margin: '2px 0 0', fontWeight: 500 }}>
                  {notifications.length === 0
                    ? 'Nenhuma notificação'
                    : unreadCount > 0
                      ? `${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'} de ${notifications.length}`
                      : `${notifications.length} ${notifications.length === 1 ? 'notificação' : 'notificações'}`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onToggle}
              title="Recolher painel"
              style={{
                width: 30, height: 30, borderRadius: 8, border: 'none',
                background: 'rgba(255,255,255,0.06)', color: '#9fadbc', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#9fadbc' }}
            >
              <ChevronLeft size={15} />
            </button>
          </div>

          {/* ── Filter tabs (full-width pills) ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {(['all', 'unread', 'mentions'] as FilterType[]).map(f => {
              const isActive = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                    background: isActive ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#3B82F6' : '#9fadbc',
                    boxShadow: isActive ? '0 0 0 1px rgba(59,130,246,0.25)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#b6c2cf' } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#9fadbc' } }}
                >
                  {FILTER_ICONS[f]}
                  {FILTER_LABELS[f]}
                  {f === 'unread' && unreadCount > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6,
                      background: '#EF4444', color: '#fff', marginLeft: 2,
                    }}>{unreadCount}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                type="button"
                onClick={handleMarkAll}
                title="Marcar todas como lidas"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600, color: '#3B82F6',
                  background: 'rgba(59,130,246,0.08)', border: 'none',
                  padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.16)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)' }}
              >
                <CheckCheck size={13} />
                Marcar todas como lidas
              </button>
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: 'rgba(166,197,226,0.08)', margin: '0 16px' }} />

        {/* ══════ NOTIFICATION LIST ══════ */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '8px 12px 80px',
            scrollbarWidth: 'thin' as const,
            scrollbarColor: 'rgba(255,255,255,0.08) transparent',
          }}
          className="inbox-scroll"
        >
          {/* Scroll shadow */}
          {scrolled && (
            <div style={{
              position: 'sticky', top: 0, left: 0, right: 0, height: 20, marginBottom: -20,
              background: 'linear-gradient(to bottom, rgba(29,33,37,0.95), transparent)',
              pointerEvents: 'none', zIndex: 5,
            }} />
          )}

          {loading ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '64px 0', gap: 12, color: '#596773',
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Clock size={24} />
              </motion.div>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Carregando notificações...</span>
            </div>
          ) : filtered.length === 0 ? (
            renderEmpty()
          ) : (
            <motion.div variants={listVariants} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {grouped.map(group => (
                <div key={group.label}>
                  {/* Date header */}
                  <div style={{
                    position: 'sticky', top: 0, zIndex: 4, padding: '10px 8px 6px',
                    background: 'var(--bg-app, #1d2125)',
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: '#596773',
                    }}>{group.label}</span>
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
                          className="inbox-notif-card"
                          style={{
                            position: 'relative',
                            display: 'flex', alignItems: 'flex-start', gap: 12,
                            padding: '14px 14px 14px 16px',
                            borderRadius: 12, cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: isUnread ? 'rgba(59,130,246,0.04)' : 'transparent',
                            borderLeft: `3px solid ${isUnread ? config.color : 'transparent'}`,
                            opacity: isUnread ? 1 : 0.6,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = isUnread ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)'
                            e.currentTarget.style.opacity = '1'
                            const actions = e.currentTarget.querySelector('.inbox-hover-actions') as HTMLElement
                            if (actions) { actions.style.opacity = '1'; actions.style.transform = 'translateX(0)' }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isUnread ? 'rgba(59,130,246,0.04)' : 'transparent'
                            e.currentTarget.style.opacity = isUnread ? '1' : '0.6'
                            const actions = e.currentTarget.querySelector('.inbox-hover-actions') as HTMLElement
                            if (actions) { actions.style.opacity = '0'; actions.style.transform = 'translateX(4px)' }
                          }}
                        >
                          {/* Type icon */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: config.bgColor, color: config.color,
                          }}>
                            {config.icon}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{
                                fontSize: 13, fontWeight: isUnread ? 700 : 600,
                                color: isUnread ? '#fff' : '#dfe1e6',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: 130,
                              }}>
                                {notif.sender_name}
                              </span>
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                                background: config.bgColor, color: config.color,
                                whiteSpace: 'nowrap',
                              }}>
                                {config.label}
                              </span>
                            </div>
                            <p style={{
                              fontSize: 12, lineHeight: 1.45, margin: 0,
                              color: isUnread ? '#b6c2cf' : '#8c9bab',
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>{notif.message}</p>
                            {notif.ticket_title && (
                              <span style={{
                                fontSize: 10, color: '#596773', marginTop: 4,
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: '100%',
                              }}>
                                <Ticket size={10} /> {notif.ticket_title}
                              </span>
                            )}
                          </div>

                          {/* Meta (time + dot) */}
                          <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                            gap: 6, flexShrink: 0, paddingTop: 2,
                          }}>
                            <span
                              title={formatFullDate(notif.created_at)}
                              style={{ fontSize: 10, color: '#596773', whiteSpace: 'nowrap', cursor: 'default' }}
                            >
                              {timeAgo(notif.created_at)}
                            </span>
                            {isUnread && (
                              <span style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: config.color,
                                boxShadow: `0 0 6px ${config.color}50`,
                                animation: 'inbox-dot-pulse 2s ease-in-out infinite',
                              }} />
                            )}
                          </div>

                          {/* Hover actions */}
                          <div
                            className="inbox-hover-actions"
                            style={{
                              position: 'absolute', right: 12, top: '50%',
                              transform: 'translateY(-50%) translateX(4px)',
                              display: 'flex', gap: 4, opacity: 0,
                              transition: 'opacity 150ms ease, transform 150ms ease',
                              pointerEvents: 'auto',
                            }}
                          >
                            {isUnread && (
                              <button
                                title="Marcar como lida"
                                onClick={(e) => handleMarkRead(e, notif.id)}
                                style={{
                                  width: 26, height: 26, borderRadius: 7, border: 'none',
                                  background: 'rgba(16,185,129,0.12)', color: '#10B981',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.12s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)' }}
                              >
                                <Check size={13} />
                              </button>
                            )}
                            {notif.ticket_id && (
                              <button
                                title="Abrir cartão"
                                onClick={(e) => handleOpen(e, notif)}
                                style={{
                                  width: 26, height: 26, borderRadius: 7, border: 'none',
                                  background: 'rgba(59,130,246,0.12)', color: '#3B82F6',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.12s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.25)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)' }}
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
