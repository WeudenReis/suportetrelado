import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CheckCheck, Clock, ChevronLeft, X } from 'lucide-react'
import { useNotificationContext } from './NotificationContext'
import type { Notification } from '../lib/supabase'
import InboxTabs from './inbox/InboxTabs'
import type { TabFilter } from './inbox/InboxTabs'
import NotificationCard, { cardVariants } from './inbox/NotificationCard'
import EmptyState from './inbox/EmptyState'

interface InboxSidebarProps {
  user: string
  collapsed: boolean
  onToggle: () => void
  onOpenTicket?: (ticketId: string) => void
}

/* ── Helpers ── */

function dateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return 'Esta semana'
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
  visible: { transition: { staggerChildren: 0.05 } },
}

/* ── Component ── */
export default function InboxSidebar({ user, collapsed, onToggle, onOpenTicket }: InboxSidebarProps) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotificationContext()
  const [filter, setFilter] = useState<TabFilter>('all')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  const mentionCount = useMemo(() => notifications.filter(n => n.type === 'mention').length, [notifications])

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

  return (
    <motion.div
      className="sidebar-root h-full flex-shrink-0 relative z-30 flex"
      style={{ width: 370 }}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

        {/* ══════ HEADER ══════ */}
        <div style={{ padding: '18px 20px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{
                fontSize: 16, fontWeight: 900, color: '#E5E7EB', margin: 0,
                fontFamily: "'Paytone One', sans-serif",
                letterSpacing: '-0.2px',
              }}>
                Caixa de Entrada
              </h2>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: '#25D066', color: '#000',
                  fontFamily: "'Space Grotesk', sans-serif",
                  lineHeight: '18px',
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={onToggle}
              title="Fechar"
              style={{
                width: 28, height: 28, borderRadius: 7, border: 'none',
                background: 'transparent', color: '#8C96A3', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#E5E7EB' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8C96A3' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ══════ TABS ══════ */}
        <InboxTabs
          active={filter}
          onChange={setFilter}
          totalCount={notifications.length}
          unreadCount={unreadCount}
          mentionCount={mentionCount}
        />

        {/* ── Mark all read ── */}
        {unreadCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 0' }}>
            <button
              type="button"
              onClick={handleMarkAll}
              title="Marcar todas como lidas"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 600, color: '#25D066',
                background: 'rgba(37,208,102,0.08)', border: 'none',
                padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.16)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
            >
              <CheckCheck size={13} />
              Marcar todas como lidas
            </button>
          </div>
        )}

        {/* ══════ NOTIFICATION LIST ══════ */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '4px 0 80px',
            scrollbarWidth: 'thin' as const,
            scrollbarColor: 'rgba(255,255,255,0.06) transparent',
          }}
          className="inbox-scroll"
        >
          {/* Scroll shadow */}
          {scrolled && (
            <div style={{
              position: 'sticky', top: 0, left: 0, right: 0, height: 16, marginBottom: -16,
              background: 'linear-gradient(to bottom, rgba(29,33,37,0.95), transparent)',
              pointerEvents: 'none', zIndex: 5,
            }} />
          )}

          {loading ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '64px 0', gap: 12, color: '#8C96A3',
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Clock size={22} />
              </motion.div>
              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Space Grotesk', sans-serif" }}>
                Carregando...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <motion.div variants={listVariants} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {grouped.map(group => (
                <div key={group.label}>
                  {/* ── Section separator ── */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 20px 6px',
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: '#8C96A3', whiteSpace: 'nowrap',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}>{group.label}</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                  </div>

                  <AnimatePresence initial={false}>
                    {group.items.map(notif => (
                      <NotificationCard
                        key={notif.id}
                        notif={notif}
                        onMarkRead={handleMarkRead}
                        onOpen={handleOpen}
                        onClick={handleItemClick}
                      />
                    ))}
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
