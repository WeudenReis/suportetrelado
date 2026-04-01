import { useState, useEffect, useCallback, useRef } from 'react'
import { Info, AlertTriangle, AlertOctagon, Plus, Pin, Trash2, X, Megaphone } from 'lucide-react'
import {
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  type Announcement, type AnnouncementSeverity,
} from '../lib/supabase'

interface AnnouncementsViewProps {
  user: string
  onClose: () => void
}

const SEVERITY: Record<AnnouncementSeverity, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  info:     { label: 'Info',    color: '#25D066', bg: 'rgba(37,208,102,0.10)',  icon: <Info size={15} /> },
  warning:  { label: 'Atenção', color: '#F5A623', bg: 'rgba(245,166,35,0.10)',  icon: <AlertTriangle size={15} /> },
  critical: { label: 'Urgente', color: '#ef5c48', bg: 'rgba(239,92,72,0.10)',   icon: <AlertOctagon size={15} /> },
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `d atrás`
  if (hrs > 0) return `h atrás`
  if (mins > 0) return `min atrás`
  return 'agora'
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
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const font = "'Space Grotesk', sans-serif"

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* HEADER */}
      <div data-gsap-child style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(37,208,102,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Megaphone size={16} style={{ color: '#25D066' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: 15, fontWeight: 900, color: '#E5E7EB', margin: 0,
                fontFamily: "'Paytone One', sans-serif",
              }}>
                Avisos
              </h2>
              <p style={{ fontSize: 11, color: '#596773', margin: 0, fontFamily: font }}>
                {announcements.length} comunicado{announcements.length !== 1 ? 's' : ''}
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

      {/* BOTAO NOVO */}
      <div data-gsap-child style={{ padding: '0 20px 14px' }}>
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
                      border: active ? `1px solid 30` : '1px solid transparent',
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
            return (
              <div
                key={ann.id}
                data-gsap-child
                onMouseEnter={() => setHoveredId(ann.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  borderRadius: 12, padding: '12px 14px',
                  background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  borderLeft: `3px solid `,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: cfg.color, fontFamily: font,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>{cfg.label}</span>
                  {ann.is_pinned && <Pin size={10} style={{ color: '#25D066', marginLeft: -2 }} />}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: '#596773', fontFamily: font }}>{timeAgo(ann.created_at)}</span>
                </div>
                <p style={{
                  fontSize: 13, fontWeight: 700, color: '#E5E7EB', margin: '0 0 2px',
                  fontFamily: font, lineHeight: '1.4',
                }}>{ann.title}</p>
                {ann.content && (
                  <p style={{
                    fontSize: 12, color: '#8C96A3', margin: '4px 0 0',
                    fontFamily: font, lineHeight: '1.5', whiteSpace: 'pre-wrap',
                  }}>{ann.content}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#596773', fontFamily: font }}>
                    por {ann.author.split('@')[0]}
                  </span>
                  <span style={{ flex: 1 }} />
                  <div style={{
                    display: 'flex', gap: 4,
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 0.15s',
                  }}>
                    <button
                      onClick={() => handleTogglePin(ann)}
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
                      onClick={() => handleDelete(ann.id)}
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
