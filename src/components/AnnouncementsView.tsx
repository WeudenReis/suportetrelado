import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Info, AlertTriangle, AlertOctagon, Plus, Pin, Trash2, X, Megaphone, ShieldAlert, TrendingUp, Clock } from 'lucide-react'
import {
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  fetchUserProfiles, insertNotification,
  type Announcement, type AnnouncementSeverity,
} from '../lib/supabase'

interface AnnouncementsViewProps {
  user: string
  onClose: () => void
}

const SEVERITY: Record<AnnouncementSeverity, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  info:     { label: 'Info',    color: '#25D066', bg: 'rgba(37,208,102,0.08)',   border: 'rgba(37,208,102,0.35)',  icon: <Info size={14} /> },
  warning:  { label: 'Atenção', color: '#F5A623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.35)',  icon: <AlertTriangle size={14} /> },
  critical: { label: 'Urgente', color: '#ef5c48', bg: 'rgba(239,92,72,0.08)',    border: 'rgba(239,92,72,0.35)',   icon: <AlertOctagon size={14} /> },
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days === 1) return '1d atrás'
  if (days > 1) return `${days}d atrás`
  if (hrs === 1) return '1h atrás'
  if (hrs > 1) return `${hrs}h atrás`
  if (mins > 1) return `${mins}min atrás`
  if (mins === 1) return '1min atrás'
  return 'agora mesmo'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function AnnouncementsView({ user, onClose }: AnnouncementsViewProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [severity, setSeverity] = useState<AnnouncementSeverity>('info')
  const [isPinned, setIsPinned] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchAnnouncements()
    setAnnouncements(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!title.trim()) return
    const ann = await insertAnnouncement({
      title: title.trim(),
      content: content.trim(),
      severity,
      author: user,
      is_pinned: isPinned,
    })
    if (ann) {
      setAnnouncements(prev => [ann, ...prev])
      setTitle(''); setContent(''); setSeverity('info'); setIsPinned(false); setShowForm(false)

      const profiles = await fetchUserProfiles()
      const authorName = user.includes('@') ? user.split('@')[0] : user
      const sevLabel = SEVERITY[severity].label
      for (const p of profiles) {
        if (p.email === user) continue
        await insertNotification({
          recipient_email: p.email,
          sender_name: authorName,
          type: 'announcement',
          ticket_id: null,
          ticket_title: `[${sevLabel}] ${ann.title}`,
          message: ann.content || ann.title,
        })
      }
    }
  }

  const handleDelete = async (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    await deleteAnnouncement(id)
  }

  const handleTogglePin = async (ann: Announcement) => {
    const v = !ann.is_pinned
    setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, is_pinned: v } : a))
    await updateAnnouncement(ann.id, { is_pinned: v })
  }

  const sorted = [...announcements].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    // Critical first within same pin tier
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    if (severityOrder[a.severity] !== severityOrder[b.severity])
      return severityOrder[a.severity] - severityOrder[b.severity]
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Analytics
  const stats = useMemo(() => {
    const c = announcements.filter(a => a.severity === 'critical').length
    const w = announcements.filter(a => a.severity === 'warning').length
    const i = announcements.filter(a => a.severity === 'info').length
    const recent24h = announcements.filter(a => {
      const ms = Date.now() - new Date(a.created_at).getTime()
      return ms < 86400000
    }).length
    return { critical: c, warning: w, info: i, recent24h, total: announcements.length }
  }, [announcements])

  // Operational health score
  const healthLabel = stats.critical > 0
    ? { text: 'ATENÇÃO URGENTE', color: '#ef5c48', bg: 'rgba(239,92,72,0.10)' }
    : stats.warning > 0
    ? { text: 'REQUER ATENÇÃO', color: '#F5A623', bg: 'rgba(245,166,35,0.10)' }
    : { text: 'OPERAÇÃO NORMAL', color: '#25D066', bg: 'rgba(37,208,102,0.10)' }

  const font = "'Space Grotesk', sans-serif"

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* HEADER */}
      <div data-gsap-child style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: stats.critical > 0 ? 'rgba(239,92,72,0.15)' : 'rgba(37,208,102,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Megaphone size={16} style={{ color: stats.critical > 0 ? '#ef5c48' : '#25D066' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: 15, fontWeight: 900, color: '#E5E7EB', margin: 0,
                fontFamily: "'Paytone One', sans-serif",
              }}>
                Avisos
              </h2>
              <p style={{ fontSize: 11, color: '#596773', margin: 0, fontFamily: font }}>
                {stats.total} comunicado{stats.total !== 1 ? 's' : ''}
                {stats.recent24h > 0 && <span style={{ color: '#F5A623', marginLeft: 6 }}>· {stats.recent24h} nas últimas 24h</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fechar"
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'transparent', color: '#596773', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* PAINEL ANALÍTICO */}
      {stats.total > 0 && (
        <div data-gsap-child style={{ padding: '0 20px 14px' }}>
          {/* Status geral */}
          <div style={{
            borderRadius: 10, padding: '10px 14px', marginBottom: 10,
            background: healthLabel.bg,
            border: `1px solid ${healthLabel.color}30`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <ShieldAlert size={14} color={healthLabel.color} />
            <span style={{ fontSize: 11, fontWeight: 800, color: healthLabel.color, fontFamily: font, letterSpacing: '0.06em' }}>
              {healthLabel.text}
            </span>
            <span style={{ flex: 1 }} />
            <Clock size={11} color={healthLabel.color} style={{ opacity: 0.7 }} />
            <span style={{ fontSize: 10, color: healthLabel.color, fontFamily: font, opacity: 0.7 }}>
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Contadores rápidos */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: 'Urgentes', value: stats.critical, ...SEVERITY.critical },
              { label: 'Atenção',  value: stats.warning,  ...SEVERITY.warning  },
              { label: 'Infos',    value: stats.info,     ...SEVERITY.info     },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, borderRadius: 8, padding: '8px 10px', textAlign: 'center',
                background: s.value > 0 ? s.bg : 'rgba(255,255,255,0.02)',
                border: `1px solid ${s.value > 0 ? s.border : 'rgba(255,255,255,0.05)'}`,
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.value > 0 ? s.color : '#4A545E', fontFamily: font, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 10, color: s.value > 0 ? s.color : '#4A545E', fontFamily: font, marginTop: 3, fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Tendência 24h */}
          {stats.recent24h > 0 && (
            <div style={{
              marginTop: 8, borderRadius: 8, padding: '7px 12px',
              background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.15)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <TrendingUp size={12} color="#F5A623" />
              <span style={{ fontSize: 11, color: '#F5A623', fontFamily: font, fontWeight: 600 }}>
                {stats.recent24h} novo{stats.recent24h > 1 ? 's' : ''} nas últimas 24 horas — monitore de perto
              </span>
            </div>
          )}
        </div>
      )}

      {/* BOTAO NOVO */}
      <div data-gsap-child style={{ padding: stats.total > 0 ? '0 20px 14px' : '0 20px 14px' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: font,
            background: showForm ? 'rgba(255,255,255,0.04)' : '#25D066',
            color: showForm ? '#8C96A3' : '#000',
            border: 'none', transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            if (!showForm) e.currentTarget.style.background = '#1BAD53'
            else e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          }}
          onMouseLeave={e => {
            if (!showForm) e.currentTarget.style.background = '#25D066'
            else e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Novo Aviso'}
        </button>
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <div data-gsap-child style={{ padding: '0 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título do aviso"
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: font,
                background: '#282E33', color: '#E5E7EB',
                border: '1px solid rgba(255,255,255,0.06)', transition: 'border 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={3}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 12, outline: 'none', resize: 'none', fontFamily: font,
                background: '#282E33', color: '#B6C2CF',
                border: '1px solid rgba(255,255,255,0.06)', lineHeight: '1.6',
                transition: 'border 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {(['info', 'warning', 'critical'] as AnnouncementSeverity[]).map(sev => {
                const cfg = SEVERITY[sev]
                const active = severity === sev
                return (
                  <button
                    key={sev}
                    onClick={() => setSeverity(sev)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 5, padding: '8px 0', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font,
                      background: active ? cfg.bg : 'rgba(255,255,255,0.03)',
                      color: active ? cfg.color : '#596773',
                      border: active ? `1px solid ${cfg.border}` : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cfg.icon} {cfg.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                onClick={() => setIsPinned(!isPinned)}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  border: isPinned ? '2px solid #25D066' : '2px solid #454F59',
                  background: isPinned ? '#25D066' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {isPinned && <Pin size={10} style={{ color: '#000' }} />}
                </div>
                <span style={{ fontSize: 12, color: '#8C96A3', fontFamily: font }}>Fixar no topo</span>
              </label>
              <button
                onClick={handleSubmit}
                disabled={!title.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  fontSize: 12, fontWeight: 700, fontFamily: font,
                  cursor: title.trim() ? 'pointer' : 'default',
                  background: title.trim() ? '#25D066' : '#2A3038',
                  color: title.trim() ? '#000' : '#596773',
                  transition: 'all 0.15s',
                }}
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LISTA */}
      <div ref={scrollRef} className="inbox-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 80px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div style={{
              width: 24, height: 24, border: '2px solid #25D06630',
              borderTop: '2px solid #25D066', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : sorted.length === 0 ? (
          <div data-gsap-child style={{ textAlign: 'center', padding: '52px 24px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
              background: 'rgba(37,208,102,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Megaphone size={24} style={{ color: '#25D066', opacity: 0.6 }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#8C96A3', margin: '0 0 4px', fontFamily: font }}>
              Nenhum aviso ainda
            </p>
            <p style={{ fontSize: 11, color: '#596773', fontFamily: font, lineHeight: '1.5' }}>
              Crie o primeiro aviso para a equipe.
            </p>
          </div>
        ) : (
          sorted.map(ann => {
            const cfg = SEVERITY[ann.severity]
            const hovered = hoveredId === ann.id
            const expanded = expandedId === ann.id
            return (
              <div
                key={ann.id}
                data-gsap-child
                onMouseEnter={() => setHoveredId(ann.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setExpandedId(expanded ? null : ann.id)}
                style={{
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  borderLeft: `3px solid ${cfg.color}`,
                  border: `1px solid ${hovered ? cfg.border : 'rgba(255,255,255,0.05)'}`,
                  borderLeft: `3px solid ${cfg.color}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: cfg.color, display: 'flex', flexShrink: 0 }}>{cfg.icon}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: cfg.color, fontFamily: font,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: cfg.bg, padding: '2px 7px', borderRadius: 99,
                  }}>{cfg.label}</span>
                  {ann.is_pinned && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#25D066', fontFamily: font,
                      background: 'rgba(37,208,102,0.1)', padding: '2px 6px', borderRadius: 99,
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <Pin size={8} /> Fixado
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span
                    title={formatDate(ann.created_at)}
                    style={{ fontSize: 10, color: '#596773', fontFamily: font, whiteSpace: 'nowrap' }}
                  >
                    {timeAgo(ann.created_at)}
                  </span>
                </div>
                <p style={{
                  fontSize: 13, fontWeight: 700, color: '#E5E7EB', margin: '0 0 2px',
                  fontFamily: font, lineHeight: '1.4',
                }}>{ann.title}</p>
                {ann.content && (
                  <p style={{
                    fontSize: 12, color: '#8C96A3', margin: '4px 0 0',
                    fontFamily: font, lineHeight: '1.5', whiteSpace: 'pre-wrap',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: expanded ? 999 : 2,
                    WebkitBoxOrient: 'vertical',
                  }}>{ann.content}</p>
                )}
                {ann.content && ann.content.length > 80 && (
                  <span style={{ fontSize: 10, color: cfg.color, fontFamily: font, marginTop: 2, display: 'inline-block', opacity: 0.7 }}>
                    {expanded ? 'ver menos ▲' : 'ver mais ▼'}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#596773', fontFamily: font }}>
                    por {ann.author.split('@')[0]}
                  </span>
                  <span style={{ fontSize: 10, color: '#3d4952', fontFamily: font }}>
                    · {formatDate(ann.created_at)}
                  </span>
                  <span style={{ flex: 1 }} />
                  <div style={{
                    display: 'flex', gap: 4,
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 0.15s',
                  }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleTogglePin(ann) }}
                      title={ann.is_pinned ? 'Desafixar' : 'Fixar no topo'}
                      style={{
                        width: 26, height: 26, borderRadius: 6, border: 'none',
                        background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: ann.is_pinned ? '#25D066' : '#8C96A3', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)'; e.currentTarget.style.color = '#25D066' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = ann.is_pinned ? '#25D066' : '#8C96A3' }}
                    >
                      <Pin size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(ann.id) }}
                      title="Remover aviso"
                      style={{
                        width: 26, height: 26, borderRadius: 6, border: 'none',
                        background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#8C96A3', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,92,72,0.15)'; e.currentTarget.style.color = '#ef5c48' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#8C96A3' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
