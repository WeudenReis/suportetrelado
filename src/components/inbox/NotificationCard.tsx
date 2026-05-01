import { memo } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../lib/icons'
import type { Notification } from '../../lib/supabase'

/* ── Helpers ── */

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const h = Math.abs(hash % 360)
  return `hsl(${h}, 55%, 45%)`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  if (hrs < 24) return `${hrs}h`
  if (days === 1) return 'ontem'
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatFull(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/* ── Type config ── */

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; borderColor: string; label: string; labelBg: string; labelColor: string }> = {
  mention:        { icon: <Icon name="AtSign" size={14} />,        borderColor: '#25D066', label: 'Menção',       labelBg: 'rgba(37,208,102,0.15)',  labelColor: '#25D066' },
  assignment:     { icon: <Icon name="UserPlus" size={14} />,      borderColor: '#3B82F6', label: 'Atribuição',   labelBg: 'rgba(59,130,246,0.15)',  labelColor: '#3B82F6' },
  comment:        { icon: <Icon name="MessageSquare" size={14} />, borderColor: '#F59E0B', label: 'Comentário',   labelBg: 'rgba(245,158,11,0.15)',  labelColor: '#F59E0B' },
  move:           { icon: <Icon name="ArrowRight" size={14} />,    borderColor: '#8B5CF6', label: 'Movido',       labelBg: 'rgba(139,92,246,0.15)',  labelColor: '#8B5CF6' },
  announcement:   { icon: <Icon name="Megaphone" size={14} />,     borderColor: '#25D066', label: 'Aviso',        labelBg: 'rgba(37,208,102,0.15)',  labelColor: '#25D066' },
  due_date_alert: { icon: <Icon name="Clock" size={14} />,         borderColor: '#F5A623', label: 'Vencimento',   labelBg: 'rgba(245,166,35,0.15)',  labelColor: '#F5A623' },
  planner_event:  { icon: <Icon name="Calendar" size={14} />,      borderColor: '#579dff', label: 'Evento',       labelBg: 'rgba(87,157,255,0.15)',  labelColor: '#579dff' },
}

/* ── Animation ── */

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, x: -20, height: 0, marginBottom: 0, transition: { duration: 0.2, ease: 'easeIn' } },
}

/* ── Component ── */

interface NotificationCardProps {
  notif: Notification
  onMarkRead: (e: React.MouseEvent, id: string) => void
  onOpen: (e: React.MouseEvent, notif: Notification) => void
  onClick: (notif: Notification) => void
}

function NotificationCard({ notif, onMarkRead, onOpen, onClick }: NotificationCardProps) {
  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.comment
  const isUnread = !notif.is_read
  const avatarBg = nameToColor(notif.sender_name)

  return (
    <motion.div
      variants={cardVariants}
      exit="exit"
      layout
      onClick={() => onClick(notif)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px 12px 0',
        marginLeft: 16, marginRight: 12,
        borderRadius: 10, cursor: 'pointer',
        borderLeft: `3px solid ${isUnread ? config.borderColor : 'transparent'}`,
        paddingLeft: 14,
        background: isUnread ? '#262c31' : '#22272b',
        transition: 'background 0.2s ease, opacity 0.2s ease',
      }}
      className="inbox-card"
      whileHover={{
        backgroundColor: isUnread ? '#2c333a' : '#2c333a',
      }}
    >
      {/* Unread dot */}
      {isUnread && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          width: 6, height: 6, borderRadius: '50%',
          background: '#25D066',
          boxShadow: '0 0 6px rgba(37,208,102,0.5)',
        }} />
      )}

      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: avatarBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: '#fff',
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: '-0.3px',
      }}>
        {initials(notif.sender_name)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Line 1: name + tag + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: isUnread ? '#fff' : '#E5E7EB',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 120,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            {notif.sender_name}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
            background: config.labelBg, color: config.labelColor,
            whiteSpace: 'nowrap', fontFamily: "'Space Grotesk', sans-serif",
          }}>
            {config.label}
          </span>
          <span
            title={formatFull(notif.created_at)}
            style={{
              fontSize: 11, color: '#8C96A3', whiteSpace: 'nowrap',
              marginLeft: 'auto', cursor: 'default',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {timeAgo(notif.created_at)}
          </span>
        </div>

        {/* Line 2: message */}
        <p style={{
          fontSize: 12, lineHeight: 1.4, margin: 0,
          color: isUnread ? '#b6c2cf' : '#8C96A3',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>{notif.message}</p>

        {/* Line 3: ticket context */}
        {notif.ticket_title && (
          <span style={{
            fontSize: 10, color: '#6B7280', marginTop: 4,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '100%', fontFamily: "'Space Grotesk', sans-serif",
          }}>
            <Icon name="Ticket" size={10} /> {notif.ticket_title}
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className="inbox-card-actions" style={{
        position: 'absolute', right: 10, bottom: 8,
        display: 'flex', gap: 4, opacity: 0,
        transform: 'translateY(2px)',
        transition: 'opacity 150ms ease, transform 150ms ease',
      }}>
        {/* Always show dismiss button */}
        <button
          title="Dispensar"
          onClick={(e) => onMarkRead(e, notif.id)}
          style={{
            width: 26, height: 26, borderRadius: 7, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#8C96A3',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#8C96A3' }}
        >
          <Icon name="X" size={12} />
        </button>
        {isUnread && (
          <button
            title="Marcar como lida"
            onClick={(e) => onMarkRead(e, notif.id)}
            style={{
              width: 26, height: 26, borderRadius: 7, border: 'none',
              background: 'rgba(37,208,102,0.12)', color: '#25D066',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.12)' }}
          >
            <Icon name="Check" size={13} />
          </button>
        )}
        {notif.ticket_id && (
          <button
            title="Abrir cartão"
            onClick={(e) => onOpen(e, notif)}
            style={{
              width: 26, height: 26, borderRadius: 7, border: 'none',
              background: 'rgba(59,130,246,0.12)', color: '#3B82F6',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)' }}
          >
            <Icon name="ExternalLink" size={13} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default memo(NotificationCard)
