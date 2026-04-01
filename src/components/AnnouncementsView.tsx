import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Info, AlertOctagon, Plus, Pin, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  type Announcement, type AnnouncementSeverity,
} from '../lib/supabase'

interface AnnouncementsViewProps {
  user: string
  onClose: () => void
}

const SEVERITY_CONFIG: Record<AnnouncementSeverity, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  info:     { label: 'Informativo', color: '#579dff', bg: 'rgba(87,157,255,0.08)',  border: 'rgba(87,157,255,0.18)',  icon: <Info size={16} /> },
  warning:  { label: 'Atenção',     color: '#e2b203', bg: 'rgba(226,178,3,0.08)',   border: 'rgba(226,178,3,0.18)',   icon: <AlertTriangle size={16} /> },
  critical: { label: 'Crítico',     color: '#ef5c48', bg: 'rgba(239,92,72,0.08)',   border: 'rgba(239,92,72,0.18)',   icon: <AlertOctagon size={16} /> },
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d atrás`
  if (hrs > 0) return `${hrs}h atrás`
  if (mins > 0) return `${mins}min atrás`
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<AnnouncementSeverity | 'all'>('all')
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
      setTitle('')
      setContent('')
      setSeverity('info')
      setIsPinned(false)
      setShowForm(false)
    }
  }

  const handleDelete = async (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    await deleteAnnouncement(id)
  }

  const handleTogglePin = async (ann: Announcement) => {
    const newPinned = !ann.is_pinned
    setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, is_pinned: newPinned } : a))
    await updateAnnouncement(ann.id, { is_pinned: newPinned })
  }

  const filtered = filterSeverity === 'all'
    ? announcements
    : announcements.filter(a => a.severity === filterSeverity)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* ══════ HEADER ══════ */}
      <div data-gsap-child style={{ padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{
              fontSize: 16, fontWeight: 900, color: '#E5E7EB', margin: 0,
              fontFamily: "'Paytone One', sans-serif",
              letterSpacing: '-0.2px',
            }}>
              Avisos
            </h2>
            {announcements.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: '#25D066', color: '#000',
                fontFamily: "'Space Grotesk', sans-serif",
                lineHeight: '18px',
              }}>
                {announcements.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
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
        <p style={{
          fontSize: 12, color: '#6B7A8D', margin: '4px 0 0',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          Comunicados importantes da supervisão
        </p>
      </div>

      {/* ══════ FILTRO POR SEVERIDADE ══════ */}
      <div data-gsap-child style={{
        display: 'flex', gap: 6, padding: '0 20px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {(['all', 'info', 'warning', 'critical'] as const).map(sev => {
          const isActive = filterSeverity === sev
          const color = sev === 'all' ? '#25D066' : SEVERITY_CONFIG[sev].color
          return (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              style={{
                padding: '5px 12px', borderRadius: 8, border: 'none',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
                background: isActive ? (sev === 'all' ? 'rgba(37,208,102,0.12)' : SEVERITY_CONFIG[sev].bg) : 'transparent',
                color: isActive ? color : '#6B7A8D',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {sev === 'all' ? 'Todos' : SEVERITY_CONFIG[sev].label}
            </button>
          )
        })}
      </div>

      {/* ══════ BOTÃO NOVO AVISO ══════ */}
      <div data-gsap-child style={{ padding: '12px 20px 8px' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
            background: 'rgba(37,208,102,0.08)', color: '#25D066',
            border: '1px dashed rgba(37,208,102,0.30)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
        >
          <Plus size={14} />
          Novo Aviso
        </button>
      </div>

      {/* ══════ FORMULÁRIO ══════ */}
      {showForm && (
        <div data-gsap-child style={{
          padding: '0 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título do aviso"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, outline: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                background: '#22272B', color: '#E5E7EB',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={3}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 12, outline: 'none', resize: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                background: '#22272B', color: '#B6C2CF',
                border: '1px solid rgba(255,255,255,0.06)',
                lineHeight: '1.5',
              }}
            />

            {/* Severidade */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7A8D', fontFamily: "'Space Grotesk', sans-serif" }}>
                Severidade:
              </span>
              {(['info', 'warning', 'critical'] as AnnouncementSeverity[]).map(sev => {
                const cfg = SEVERITY_CONFIG[sev]
                const isActive = severity === sev
                return (
                  <button
                    key={sev}
                    onClick={() => setSeverity(sev)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6, border: 'none',
                      fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                      background: isActive ? cfg.bg : 'transparent',
                      color: isActive ? cfg.color : '#6B7A8D',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                )
              })}
            </div>

            {/* Pin + Ações */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={e => setIsPinned(e.target.checked)}
                  style={{ accentColor: '#25D066' }}
                />
                <span style={{ fontSize: 11, color: '#6B7A8D', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Fixar no topo
                </span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: 'transparent', color: '#6B7A8D',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim()}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none',
                    fontSize: 11, fontWeight: 700, cursor: title.trim() ? 'pointer' : 'default',
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: title.trim() ? '#25D066' : 'rgba(37,208,102,0.3)',
                    color: '#000',
                    transition: 'all 0.15s',
                  }}
                >
                  Publicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ LISTA DE AVISOS ══════ */}
      <div
        ref={scrollRef}
        className="inbox-scroll"
        style={{
          flex: 1, overflowY: 'auto', padding: '8px 20px 80px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        {loading ? (
          <p style={{
            textAlign: 'center', padding: '40px 0',
            fontSize: 12, color: '#6B7A8D',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Carregando avisos...
          </p>
        ) : filtered.length === 0 ? (
          <div data-gsap-child style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
              background: 'rgba(255,255,255,0.03)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={24} style={{ color: '#454F59' }} />
            </div>
            <p style={{
              fontSize: 13, fontWeight: 700, color: '#8C96A3', margin: '0 0 4px',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Nenhum aviso
            </p>
            <p style={{
              fontSize: 11, color: '#596773',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Quando houver comunicados, eles aparecem aqui.
            </p>
          </div>
        ) : (
          filtered.map(ann => {
            const cfg = SEVERITY_CONFIG[ann.severity]
            const isExpanded = expandedId === ann.id
            return (
              <div
                key={ann.id}
                data-gsap-child
                style={{
                  borderRadius: 12, overflow: 'hidden',
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  transition: 'all 0.15s',
                }}
              >
                {/* Cabeçalho do aviso */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 14px', cursor: 'pointer',
                  }}
                >
                  <span style={{ color: cfg.color, marginTop: 1, flexShrink: 0 }}>{cfg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {ann.is_pinned && <Pin size={10} style={{ color: cfg.color }} />}
                      <p style={{
                        fontSize: 13, fontWeight: 700, color: '#E5E7EB', margin: 0,
                        fontFamily: "'Space Grotesk', sans-serif",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ann.title}
                      </p>
                    </div>
                    <p style={{
                      fontSize: 10, color: '#6B7A8D', margin: '3px 0 0',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}>
                      {ann.author.split('@')[0]} · {timeAgo(ann.created_at)}
                    </p>
                  </div>
                  <span style={{ color: '#6B7A8D', marginTop: 2 }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>

                {/* Conteúdo expandido */}
                {isExpanded && (
                  <div style={{
                    padding: '0 14px 12px',
                    borderTop: `1px solid ${cfg.border}`,
                  }}>
                    {ann.content && (
                      <p style={{
                        fontSize: 12, color: '#B6C2CF', margin: '10px 0 0',
                        fontFamily: "'Space Grotesk', sans-serif",
                        lineHeight: '1.6', whiteSpace: 'pre-wrap',
                      }}>
                        {ann.content}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleTogglePin(ann) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '5px 10px', borderRadius: 6, border: 'none',
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          fontFamily: "'Space Grotesk', sans-serif",
                          background: 'rgba(255,255,255,0.04)',
                          color: ann.is_pinned ? cfg.color : '#6B7A8D',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      >
                        <Pin size={10} /> {ann.is_pinned ? 'Desafixar' : 'Fixar'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(ann.id) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '5px 10px', borderRadius: 6, border: 'none',
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          fontFamily: "'Space Grotesk', sans-serif",
                          background: 'rgba(239,92,72,0.08)',
                          color: '#ef5c48',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,92,72,0.14)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,92,72,0.08)' }}
                      >
                        <Trash2 size={10} /> Remover
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
