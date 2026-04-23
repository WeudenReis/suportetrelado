import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Info, AlertTriangle, AlertOctagon, Plus, Pin, Trash2, X, Megaphone, ShieldAlert, TrendingUp, Clock, Paperclip, Image as ImageIcon, Video as VideoIcon, FileText, Download, Loader2 } from 'lucide-react'
import { useAnnouncementContext } from './useAnnouncementContext'
import {
  fetchUserProfiles, insertNotification,
  uploadAnnouncementAttachment, deleteAnnouncementAttachmentObject,
  type AnnouncementAttachment, type AnnouncementSeverity,
} from '../lib/supabase'
import { compressAttachment } from '../lib/imageUtils'
import { useOrg } from '../lib/orgContext'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB por arquivo

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

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
  const { announcements, loading, addAnnouncement, togglePin, removeAnnouncement } = useAnnouncementContext()
  const { departmentId } = useOrg()

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [severity, setSeverity] = useState<AnnouncementSeverity>('info')
  const [isPinned, setIsPinned] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<AnnouncementAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Upload central: usado por botão, drop e paste ──
  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length || !departmentId) {
      if (!departmentId) showToast('Selecione um departamento antes de anexar.', 'err')
      return
    }
    const valid: File[] = []
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        showToast(`"${f.name}" excede o limite de ${formatBytes(MAX_FILE_BYTES)}.`, 'err')
        continue
      }
      valid.push(f)
    }
    if (!valid.length) return
    setUploading(true)
    try {
      for (const file of valid) {
        const compressed = await compressAttachment(file)
        const att = await uploadAnnouncementAttachment(compressed, departmentId)
        if (att) setPendingAttachments(prev => [...prev, att])
        else showToast(`Falha ao enviar "${file.name}".`, 'err')
      }
    } finally {
      setUploading(false)
    }
  }, [departmentId, showToast])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    processFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemovePending = async (att: AnnouncementAttachment) => {
    setPendingAttachments(prev => prev.filter(a => a.storage_path !== att.storage_path))
    await deleteAnnouncementAttachmentObject(att.storage_path)
  }

  // ── Paste (Ctrl+V) — só ativo quando o formulário está aberto ──
  useEffect(() => {
    if (!showForm) return
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageFiles = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((f): f is File => f !== null)
      if (!imageFiles.length) return
      e.preventDefault()
      processFiles(imageFiles)
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [showForm, processFiles])

  // ── Drag & Drop handlers ──
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items.length > 0) setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false) }
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  const resetForm = () => {
    setTitle(''); setContent(''); setSeverity('info'); setIsPinned(false)
    setPendingAttachments([]); setShowForm(false)
  }

  // Limpa anexos órfãos no Storage caso usuário clique em Cancelar com uploads pendentes
  const handleCancel = async () => {
    const orphans = pendingAttachments
    setPendingAttachments([])
    setShowForm(false)
    if (orphans.length) {
      await Promise.all(orphans.map(a => deleteAnnouncementAttachmentObject(a.storage_path)))
    }
  }

  const handleSubmit = async () => {
    if (!title.trim() || submitting || uploading) return
    setSubmitting(true)
    const ann = await addAnnouncement({
      title: title.trim(),
      content: content.trim(),
      severity,
      author: user,
      is_pinned: isPinned,
      attachments: pendingAttachments,
    })
    setSubmitting(false)
    if (ann) {
      resetForm()

      const profiles = await fetchUserProfiles()
      const authorName = user.includes('@') ? user.split('@')[0] : user
      const sevLabel = SEVERITY[severity].label
      const targetDepartmentId = ann.department_id || departmentId
      if (!targetDepartmentId) return

      const recipients = Array.from(new Set(
        profiles
          .map(p => p.email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email))
      ))

      for (const recipientEmail of recipients) {
        await insertNotification({
          department_id: targetDepartmentId,
          recipient_email: recipientEmail,
          sender_name: authorName,
          type: 'announcement',
          ticket_id: null,
          ticket_title: `[${sevLabel}] ${ann.title}`,
          message: ann.content || ann.title,
        })
      }
    }
  }

  const sorted = [...announcements].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    if (severityOrder[a.severity] !== severityOrder[b.severity])
      return severityOrder[a.severity] - severityOrder[b.severity]
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const stats = useMemo(() => {
    const c = announcements.filter(a => a.severity === 'critical').length
    const w = announcements.filter(a => a.severity === 'warning').length
    const i = announcements.filter(a => a.severity === 'info').length
    const now = Date.now()
    const recent24h = announcements.filter(a => {
      const ms = now - new Date(a.created_at).getTime()
      return ms < 86400000
    }).length
    return { critical: c, warning: w, info: i, recent24h, total: announcements.length }
  }, [announcements])

  const healthLabel = stats.critical > 0
    ? { text: 'ATENÇÃO URGENTE', color: '#ef5c48', bg: 'rgba(239,92,72,0.10)' }
    : stats.warning > 0
    ? { text: 'REQUER ATENÇÃO', color: '#F5A623', bg: 'rgba(245,166,35,0.10)' }
    : { text: 'OPERAÇÃO NORMAL', color: '#25D066', bg: 'rgba(37,208,102,0.10)' }

  const font = "'Space Grotesk', sans-serif"

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* HEADER */}
      <div data-stagger-child style={{ padding: '20px 20px 16px' }}>
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
        <div data-stagger-child style={{ padding: '0 20px 14px' }}>
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

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { displayLabel: 'Urgentes', value: stats.critical, ...SEVERITY.critical },
              { displayLabel: 'Atenção',  value: stats.warning,  ...SEVERITY.warning  },
              { displayLabel: 'Infos',    value: stats.info,     ...SEVERITY.info     },
            ].map(s => (
              <div key={s.displayLabel} style={{
                flex: 1, borderRadius: 8, padding: '8px 10px', textAlign: 'center',
                background: s.value > 0 ? s.bg : 'rgba(255,255,255,0.02)',
                border: `1px solid ${s.value > 0 ? s.border : 'rgba(255,255,255,0.05)'}`,
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.value > 0 ? s.color : '#4A545E', fontFamily: font, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 10, color: s.value > 0 ? s.color : '#4A545E', fontFamily: font, marginTop: 3, fontWeight: 600 }}>
                  {s.displayLabel}
                </div>
              </div>
            ))}
          </div>

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
      <div data-stagger-child style={{ padding: '0 20px 14px' }}>
        <button
          onClick={() => showForm ? handleCancel() : setShowForm(true)}
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
        <div
          data-stagger-child
          style={{ padding: '0 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
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
            {/* ── Anexos ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Paperclip size={12} style={{ color: isDragging ? '#25D066' : '#596773', transition: 'color 0.15s' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#8C96A3', fontFamily: font }}>
                  Anexos {pendingAttachments.length > 0 && <span style={{ color: '#25D066' }}>({pendingAttachments.length})</span>}
                </span>
                {isDragging && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#25D066', fontFamily: font, animation: 'pulse 1s infinite' }}>
                    Solte para anexar
                  </span>
                )}
              </div>

              {(pendingAttachments.length > 0 || uploading) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {pendingAttachments.map(att => (
                    <div
                      key={att.storage_path}
                      style={{
                        position: 'relative', borderRadius: 8, overflow: 'hidden',
                        background: '#22272b', border: '1px solid rgba(166,197,226,0.10)',
                      }}
                    >
                      {att.type === 'image' ? (
                        <img src={att.url} alt={att.name} style={{ width: '100%', height: 64, objectFit: 'cover', display: 'block' }} />
                      ) : att.type === 'video' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, background: 'rgba(87,157,255,0.06)' }}>
                          <VideoIcon size={20} style={{ color: '#579dff' }} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, background: 'rgba(245,166,35,0.06)' }}>
                          <FileText size={20} style={{ color: '#F5A623' }} />
                        </div>
                      )}
                      <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontSize: 9, color: '#8C96A3', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {att.name}
                        </span>
                        <button
                          onClick={() => handleRemovePending(att)}
                          title="Remover"
                          style={{
                            width: 18, height: 18, borderRadius: 4, border: 'none',
                            background: 'rgba(239,92,72,0.15)', color: '#ef5c48',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {uploading && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 4, height: 88, borderRadius: 8,
                      background: '#22272b', border: '2px dashed rgba(37,208,102,0.25)',
                    }}>
                      <Loader2 size={16} className="animate-spin" style={{ color: '#25D066' }} />
                      <span style={{ fontSize: 9, color: '#596773', fontFamily: font }}>Enviando...</span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !departmentId}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '8px 0', borderRadius: 8,
                  fontSize: 11, fontWeight: 600, fontFamily: font,
                  background: isDragging ? 'rgba(37,208,102,0.08)' : 'rgba(255,255,255,0.03)',
                  border: isDragging ? '1px dashed rgba(37,208,102,0.5)' : '1px dashed rgba(166,197,226,0.12)',
                  color: isDragging ? '#25D066' : '#8C96A3',
                  cursor: uploading || !departmentId ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <ImageIcon size={12} />
                {isDragging ? 'Solte os arquivos aqui' : uploading ? 'Enviando...' : 'Adicionar arquivo'}
              </button>
              <p style={{ fontSize: 9, textAlign: 'center', color: '#3b4755', fontFamily: font, margin: 0 }}>
                Ctrl+V para colar · Arraste arquivos · Máx {formatBytes(MAX_FILE_BYTES)}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
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
                disabled={!title.trim() || uploading || submitting}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  fontSize: 12, fontWeight: 700, fontFamily: font,
                  cursor: !title.trim() || uploading || submitting ? 'not-allowed' : 'pointer',
                  background: title.trim() && !uploading && !submitting ? '#25D066' : '#2A3038',
                  color: title.trim() && !uploading && !submitting ? '#000' : '#596773',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                {submitting ? 'Publicando...' : uploading ? 'Aguarde upload...' : 'Publicar'}
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
          <div data-stagger-child style={{ textAlign: 'center', padding: '52px 24px' }}>
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
                data-stagger-child
                onMouseEnter={() => setHoveredId(ann.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setExpandedId(expanded ? null : ann.id)}
                style={{
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  borderTop: `1px solid ${hovered ? cfg.border : 'rgba(255,255,255,0.05)'}`,
                  borderRight: `1px solid ${hovered ? cfg.border : 'rgba(255,255,255,0.05)'}`,
                  borderBottom: `1px solid ${hovered ? cfg.border : 'rgba(255,255,255,0.05)'}`,
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

                {/* ── Anexos ── */}
                {ann.attachments && ann.attachments.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
                    {ann.attachments.filter(a => a.type === 'image').length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
                        {ann.attachments.filter(a => a.type === 'image').map(att => (
                          <a
                            key={att.storage_path}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'block', borderRadius: 8, overflow: 'hidden',
                              border: '1px solid rgba(255,255,255,0.06)',
                              transition: 'transform 0.2s ease, border-color 0.2s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = cfg.border }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                          >
                            <img src={att.url} alt={att.name} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                          </a>
                        ))}
                      </div>
                    )}
                    {ann.attachments.filter(a => a.type === 'video').map(att => (
                      <video
                        key={att.storage_path}
                        src={att.url}
                        controls
                        preload="metadata"
                        style={{ width: '100%', maxHeight: 240, borderRadius: 8, background: '#000', border: '1px solid rgba(255,255,255,0.06)' }}
                      />
                    ))}
                    {ann.attachments.filter(a => a.type === 'file').map(att => (
                      <a
                        key={att.storage_path}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        download={att.name}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          color: '#B6C2CF', fontFamily: font, textDecoration: 'none',
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = cfg.bg; e.currentTarget.style.borderColor = cfg.border }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: cfg.bg, color: cfg.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <FileText size={14} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.name}
                          </div>
                          <div style={{ fontSize: 9, color: '#596773' }}>{formatBytes(att.size)}</div>
                        </div>
                        <Download size={12} style={{ color: '#596773', flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
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
                      onClick={e => { e.stopPropagation(); togglePin(ann) }}
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
                      onClick={e => { e.stopPropagation(); removeAnnouncement(ann.id) }}
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

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 16px', borderRadius: 10, fontFamily: font,
          fontSize: 12, fontWeight: 700, zIndex: 100,
          background: toast.type === 'ok' ? 'rgba(37,208,102,0.95)' : 'rgba(239,92,72,0.95)',
          color: toast.type === 'ok' ? '#000' : '#fff',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
