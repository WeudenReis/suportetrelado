import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Info, AlertOctagon, Plus, Pin, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  type Announcement, type AnnouncementSeverity,
} from '../lib/supabase'

interface AnnouncementsViewProps {
  user: string
  onClose: () => void
}

const SEVERITY_CONFIG: Record<AnnouncementSeverity, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  info:     { label: 'Informativo', color: '#579dff', bg: 'rgba(87,157,255,0.10)', icon: <Info size={16} /> },
  warning:  { label: 'Atenção',     color: '#e2b203', bg: 'rgba(226,178,3,0.10)',  icon: <AlertTriangle size={16} /> },
  critical: { label: 'Crítico',     color: '#ef5c48', bg: 'rgba(239,92,72,0.10)',  icon: <AlertOctagon size={16} /> },
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
    <div className="flex flex-col h-full" data-gsap-child>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(166,197,226,0.08)' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} style={{ color: '#e2b203' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#b6c2cf' }}>Avisos do Supervisor</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: '#596773' }}>
          <X size={16} />
        </button>
      </div>

      {/* Filtro por severidade */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b" style={{ borderColor: 'rgba(166,197,226,0.06)' }} data-gsap-child>
        {(['all', 'info', 'warning', 'critical'] as const).map(sev => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
            style={{
              background: filterSeverity === sev ? (sev === 'all' ? 'rgba(255,255,255,0.08)' : SEVERITY_CONFIG[sev].bg) : 'transparent',
              color: filterSeverity === sev ? (sev === 'all' ? '#b6c2cf' : SEVERITY_CONFIG[sev].color) : '#596773',
              border: '1px solid transparent',
            }}
          >
            {sev === 'all' ? 'Todos' : SEVERITY_CONFIG[sev].label}
          </button>
        ))}
      </div>

      {/* Botão adicionar */}
      <div className="px-4 py-2" data-gsap-child>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
          style={{ background: 'rgba(37,208,102,0.08)', color: '#25D066', border: '1px dashed rgba(37,208,102,0.25)' }}
        >
          <Plus size={14} />
          Novo Aviso
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="px-4 pb-3 space-y-2" style={{ borderBottom: '1px solid rgba(166,197,226,0.06)' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do aviso"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#282e33', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.12)' }}
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
            style={{ background: '#282e33', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.12)' }}
          />
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium" style={{ color: '#596773' }}>Severidade:</label>
            {(['info', 'warning', 'critical'] as AnnouncementSeverity[]).map(sev => (
              <button
                key={sev}
                onClick={() => setSeverity(sev)}
                className="px-2 py-1 rounded text-[10px] font-bold transition-colors"
                style={{
                  background: severity === sev ? SEVERITY_CONFIG[sev].bg : 'transparent',
                  color: severity === sev ? SEVERITY_CONFIG[sev].color : '#596773',
                  border: `1px solid ${severity === sev ? SEVERITY_CONFIG[sev].color + '40' : 'transparent'}`,
                }}
              >
                {SEVERITY_CONFIG[sev].label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="accent-green-500" />
              <span className="text-[11px]" style={{ color: '#596773' }}>Fixar no topo</span>
            </label>
            <div className="flex gap-1.5">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded text-xs" style={{ color: '#596773' }}>
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim()}
                className="px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-40"
                style={{ background: '#25D066', color: '#000' }}
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de avisos */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 inbox-scroll">
        {loading ? (
          <p className="text-center text-xs py-8" style={{ color: '#596773' }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10" data-gsap-child>
            <AlertTriangle size={32} className="mx-auto mb-2" style={{ color: '#596773', opacity: 0.4 }} />
            <p className="text-xs" style={{ color: '#596773' }}>Nenhum aviso encontrado</p>
          </div>
        ) : (
          filtered.map(ann => {
            const cfg = SEVERITY_CONFIG[ann.severity]
            const isExpanded = expandedId === ann.id
            return (
              <div
                key={ann.id}
                className="rounded-lg overflow-hidden transition-colors"
                style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}
                data-gsap-child
              >
                <div
                  className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                >
                  <span className="mt-0.5 flex-shrink-0" style={{ color: cfg.color }}>{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {ann.is_pinned && <Pin size={10} style={{ color: cfg.color }} />}
                      <p className="text-sm font-semibold truncate" style={{ color: '#b6c2cf' }}>{ann.title}</p>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: '#596773' }}>
                      {ann.author.split('@')[0]} · {timeAgo(ann.created_at)}
                    </p>
                  </div>
                  <span style={{ color: '#596773' }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-2.5" style={{ borderTop: `1px solid ${cfg.color}15` }}>
                    {ann.content && (
                      <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: '#8c9bab', lineHeight: '1.5' }}>{ann.content}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={e => { e.stopPropagation(); handleTogglePin(ann) }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-white/5 transition-colors"
                        style={{ color: ann.is_pinned ? cfg.color : '#596773' }}
                      >
                        <Pin size={10} /> {ann.is_pinned ? 'Desafixar' : 'Fixar'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(ann.id) }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-red-500/10 transition-colors"
                        style={{ color: '#ef5c48' }}
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
