import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { AnimatePresence } from 'framer-motion'
import {
  X, MessageSquare, Trash2, Send, Loader2,
  ArrowRight, ExternalLink, MoreHorizontal,
  AlignLeft, CreditCard, Paperclip, Check, User, Calendar,
  CheckSquare, Square, Plus, Link2, Pencil, Lock
} from 'lucide-react'
import {
  supabase, updateTicket, deleteTicket,
  fetchComments, insertComment, deleteComment,
  fetchActivityLog, insertActivityLog,
  extractMentionNames, resolveMentionsToEmails, insertNotification,
  fetchUserProfiles,
  fetchBoardLabels, updateBoardLabel, deleteBoardLabel
} from '../lib/supabase'
import { compressCover, compressThumbnail } from '../lib/imageUtils'
import CardAttachments from './card/CardAttachments'
import { useOrg } from '../lib/org'
import { logger } from '../lib/logger'
import type { Ticket, TicketStatus, Comment, ActivityLog, UserProfile, BoardLabel } from '../lib/supabase'
import type { BoardColumn } from '../lib/boardColumns'
import { parseTag } from '../lib/tagUtils'
export { parseTag }

interface CardDetailModalProps {
  ticket: Ticket
  user: string
  onClose: () => void
  onUpdate: (ticket: Ticket) => void
  onDelete: (id: string) => void
  boardColumns?: BoardColumn[]
}

// Fallback caso o board ainda nao tenha colunas carregadas (estado raro,
// preserva os rotulos legados para nao quebrar logs antigos).
const LEGACY_STATUS_MAP: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'Em andamento',
  waiting_devs: 'Aguardando Devs',
  resolved: 'Concluido',
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `ha ${days}d`
  if (hrs > 0) return `ha ${hrs}h`
  if (mins > 0) return `ha ${mins} minutos`
  return 'ha pouco'
}

const avatarPalette = ['#579dff', '#6366f1', '#f5a623', '#ef5c48', '#06b6d4', '#8b5cf6', '#ec4899']
function avatarColor(name: string) {
  return avatarPalette[name.charCodeAt(0) % avatarPalette.length]
}

function renderCommentText(text: string): React.ReactNode {
  if (!text) return text
  try {
    const parts = text.split(/(@[\w\u00C0-\u024F]+)/g)
    return parts.map((part, i) =>
      /^@[\w\u00C0-\u024F]+$/.test(part)
        ? <span key={i} className="mention-highlight">{part}</span>
        : part
    )
  } catch {
    return text
  }
}

const TAG_COLORS = ['#ef5c48', '#e2b203', '#4bce97', '#579dff', '#6366f1', '#a259ff', '#ec4899', '#06b6d4', '#f97316', '#596773']

export default function CardDetailModal({ ticket, user, onClose, onUpdate, onDelete, boardColumns = [] }: CardDetailModalProps) {
  const { departmentId: userDeptId } = useOrg()
  const statusLabel = useCallback((id: string) => {
    const col = boardColumns.find(c => c.id === id)
    return col?.title || LEGACY_STATUS_MAP[id] || id
  }, [boardColumns])
  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description || '')
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [priority, setPriority] = useState(ticket.priority)
  const [assignee, setAssignee] = useState(ticket.assignee || '')
  const [cliente, setCliente] = useState(ticket.cliente || '')
  const [instancia, setInstancia] = useState(ticket.instancia || '')
  const [linkRetaguarda, setLinkRetaguarda] = useState(ticket.link_retaguarda || '')
  const [linkSessao, setLinkSessao] = useState(ticket.link_sessao || '')
  const [observacao, setObservacao] = useState(ticket.observacao || '')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const savingRef = useRef(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [commentFocused, setCommentFocused] = useState(false)
  const [isInternalNote, setIsInternalNote] = useState(false)

  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'comments' | 'activity'>('all')
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dueDate, setDueDate] = useState(ticket.due_date || '')
  const [tags, setTags] = useState<string[]>(ticket.tags || [])
  const [boardLabels, setBoardLabels] = useState<BoardLabel[]>([])
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelName, setEditingLabelName] = useState('')
  const [editingLabelColor, setEditingLabelColor] = useState('')
  const [coverImage, setCoverImage] = useState(ticket.cover_image_url || '')
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Checklist state — auto-show if observacao already has checklist items
  const [showChecklist, setShowChecklist] = useState(() => /^[☐☑]/m.test(ticket.observacao || ''))
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const checklistInputRef = useRef<HTMLInputElement>(null)

  // Multi-member state
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [members, setMembers] = useState<string[]>(() => {
    const raw = ticket.assignee || ''
    return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : []
  })


  const commentRef = useRef<HTMLTextAreaElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const mentionStartPos = useRef<number>(0)

  // GSAP refs
  const overlayRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  useFocusTrap(modalRef, isVisible)

  // ─── CSS entrance animation ──────────────────────────────
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  useEffect(() => {
    setTitle(ticket.title)
    setDescription(ticket.description || '')
    setStatus(ticket.status)
    setPriority(ticket.priority)
    setAssignee(ticket.assignee || '')
    setCliente(ticket.cliente || '')
    setInstancia(ticket.instancia || '')
    setLinkRetaguarda(ticket.link_retaguarda || '')
    setLinkSessao(ticket.link_sessao || '')
    setObservacao(ticket.observacao || '')
    setTags(ticket.tags || [])
  }, [ticket])

  useEffect(() => {
    fetchComments(ticket.id).then(setComments)
    fetchActivityLog(ticket.id).then(setActivities)
  }, [ticket.id])

  // Load user profiles for mention autocomplete
  useEffect(() => {
    fetchUserProfiles().then(setAllUsers)
  }, [])

  // Load board labels when label picker opens
  useEffect(() => {
    if (showLabelPicker) {
      fetchBoardLabels().then(setBoardLabels).catch(err => logger.error('CardDetail', 'Falha ao carregar labels', { error: String(err) }))
    }
  }, [showLabelPicker])

  useEffect(() => {
    const ch = supabase
      .channel(`modal-${ticket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticket.id}` }, p => {
        setComments(prev => prev.some(c => c.id === (p.new as Comment).id) ? prev : [...prev, p.new as Comment])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticket.id}` }, p => {
        setComments(prev => prev.filter(c => c.id !== (p.old as Record<string, string>).id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `card_id=eq.${ticket.id}` }, p => {
        setActivities(prev => prev.some(a => a.id === (p.new as ActivityLog).id) ? prev : [...prev, p.new as ActivityLog])
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [ticket.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length, activities.length])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 250)
  }, [onClose])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [handleClose])

  useEffect(() => {
    const closeMenu = () => setShowMoreMenu(false)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const saveQueue = useRef<Partial<Ticket>[]>([])
  const processQueue = useCallback(async () => {
    if (savingRef.current) return
    const next = saveQueue.current.shift()
    if (!next) return
    savingRef.current = true
    setSaving(true)
    try {
      const updated = await updateTicket(ticket.id, next)
      onUpdate(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      logger.error('CardDetail', 'Falha ao salvar alterações', { error: String(err) })
    }
    setSaving(false)
    savingRef.current = false
    if (saveQueue.current.length > 0) processQueue() // eslint-disable-line react-hooks/immutability -- recursão intencional na fila
  }, [ticket.id, onUpdate])

  const save = useCallback(async (updates: Partial<Ticket>) => {
    saveQueue.current.push(updates)
    processQueue()
  }, [processQueue])

  const handleSaveAll = async () => {
    if (savingRef.current) return
    const updates: Partial<Ticket> = {}
    if (title.trim() && title.trim() !== ticket.title) updates.title = title.trim()
    if (description !== (ticket.description || '')) updates.description = description
    if (status !== ticket.status) updates.status = status
    if (priority !== ticket.priority) updates.priority = priority
    if (assignee !== (ticket.assignee || '')) updates.assignee = assignee || null
    if (cliente !== (ticket.cliente || '')) updates.cliente = cliente
    if (instancia !== (ticket.instancia || '')) updates.instancia = instancia
    if (linkRetaguarda !== (ticket.link_retaguarda || '')) updates.link_retaguarda = linkRetaguarda
    if (linkSessao !== (ticket.link_sessao || '')) updates.link_sessao = linkSessao
    if (observacao !== (ticket.observacao || '')) updates.observacao = observacao

    if (Object.keys(updates).length > 0) {
      await save(updates)
      if (updates.status) {
        const oldLabel = statusLabel(ticket.status)
        const newLabel = statusLabel(updates.status)
        await insertActivityLog(ticket.id, user, `moveu este cartao de ${oldLabel} para ${newLabel}`, ticket.department_id)
      }
    }
  }

  const hasPendingChanges = () => (
    (title.trim() && title.trim() !== ticket.title)
    || description !== (ticket.description || '')
    || status !== ticket.status
    || priority !== ticket.priority
    || assignee !== (ticket.assignee || '')
    || cliente !== (ticket.cliente || '')
    || instancia !== (ticket.instancia || '')
    || linkRetaguarda !== (ticket.link_retaguarda || '')
    || linkSessao !== (ticket.link_sessao || '')
    || observacao !== (ticket.observacao || '')
  )

  const saveOnBlur = async () => {
    if (hasPendingChanges()) await handleSaveAll()
  }

  const handleTitleBlur = async () => {
    if (title.trim() && title.trim() !== ticket.title) {
      await save({ title: title.trim() })
    }
  }

  // Mention autocomplete helpers
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filteredMentionUsers = mentionQuery !== null
    ? allUsers.filter(u => {
        const q = normalize(mentionQuery)
        if (u.email.toLowerCase() === user.toLowerCase()) return false
        if (!q) return true // show all when just "@"
        return normalize(u.name).includes(q) || normalize(u.email.split('@')[0]).includes(q)
      })
    : []

  const applyMention = (profile: UserProfile) => {
    const before = newComment.slice(0, mentionStartPos.current)
    const after = newComment.slice(commentRef.current?.selectionStart ?? mentionStartPos.current + (mentionQuery?.length ?? 0) + 1)
    const inserted = `@${profile.name} `
    setNewComment(before + inserted + after)
    setMentionQuery(null)
    setTimeout(() => {
      if (commentRef.current) {
        const pos = before.length + inserted.length
        commentRef.current.selectionStart = pos
        commentRef.current.selectionEnd = pos
        commentRef.current.focus()
      }
    }, 0)
  }

  const handleSendComment = async () => {
    if (!newComment.trim()) return
    setSendingComment(true)
    const commentText = isInternalNote ? `[INTERNO] ${newComment.trim()}` : newComment.trim()
    setMentionQuery(null)
    try {
      const c = await insertComment(ticket.id, user, commentText, ticket.department_id)
      if (c) setComments(prev => [...prev, c])
      setNewComment('')
      setIsInternalNote(false)
      setSendingComment(false)
      commentRef.current?.focus()

      // Detect @nome mentions and create notifications
      const mentionNames = extractMentionNames(commentText)
      if (mentionNames.length > 0) {
        const { data: { session } } = await supabase.auth.getSession()
        const fullName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || ''
        const firstName = fullName ? fullName.split(' ')[0] : user.split('@')[0]
        const senderDisplayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()

        const emails = await resolveMentionsToEmails(mentionNames)
        for (const email of emails) {
          if (email.toLowerCase() !== user.toLowerCase()) {
            await insertNotification({
              department_id: ticket.department_id || '',
              recipient_email: email,
              sender_name: senderDisplayName,
              type: 'mention',
              ticket_id: ticket.id,
              ticket_title: ticket.title,
              message: `mencionou você: "${commentText.length > 80 ? commentText.slice(0, 80) + '…' : commentText}"`,
            })
          }
        }
      }
    } catch (err) {
      logger.error('CardDetail', 'Falha ao enviar comentário', { error: String(err) })
      setSendingComment(false)
    }
  }

  const handleDeleteComment = async (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id))
    await deleteComment(id)
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      const [coverFile, thumbFile] = await Promise.all([
        compressCover(file),
        compressThumbnail(file),
      ])

      const localPreview = URL.createObjectURL(coverFile)
      setCoverImage(localPreview)

      const ts = Date.now()
      // Prioridade: dept do ticket → dept ativo do usuário → 'shared/' (tickets legados sem dept)
      const resolvedDeptId = ticket.department_id ?? userDeptId ?? null
      const deptPrefix = resolvedDeptId ? `${resolvedDeptId}/` : 'shared/'
      const coverPath = `${deptPrefix}${ticket.id}/cover_${ts}.webp`
      const thumbPath = `${deptPrefix}${ticket.id}/thumb_${ts}.webp`

      const [coverResult, thumbResult] = await Promise.all([
        supabase.storage.from('attachments').upload(coverPath, coverFile),
        supabase.storage.from('attachments').upload(thumbPath, thumbFile),
      ])

      if (coverResult.error) {
        logger.error('CardDetail', 'Cover upload falhou', { error: String(coverResult.error) })
        URL.revokeObjectURL(localPreview)
        setCoverImage('')
        setUploadingCover(false)
        if (coverInputRef.current) coverInputRef.current.value = ''
        return
      }

      // Usar signed URLs (10 anos) em vez de public URLs — funciona mesmo com bucket não-público
      const TEN_YEARS = 60 * 60 * 24 * 365 * 10
      const [coverSigned, thumbSigned] = await Promise.all([
        supabase.storage.from('attachments').createSignedUrl(coverPath, TEN_YEARS),
        !thumbResult.error
          ? supabase.storage.from('attachments').createSignedUrl(thumbPath, TEN_YEARS)
          : Promise.resolve({ data: null, error: null }),
      ])

      const coverUrl = coverSigned.data?.signedUrl
        || supabase.storage.from('attachments').getPublicUrl(coverPath).data.publicUrl
      const thumbUrl = thumbSigned.data?.signedUrl || coverUrl

      try {
        const updated = await updateTicket(ticket.id, { cover_image_url: coverUrl, cover_thumb_url: thumbUrl })
        setCoverImage(coverUrl)
        URL.revokeObjectURL(localPreview)
        onUpdate(updated)
      } catch (dbErr) {
        logger.error('CardDetail', 'Cover DB save falhou', { error: String(dbErr) })
      }
    } catch (err) {
      logger.error('CardDetail', 'Cover erro inesperado', { error: String(err) })
      setCoverImage('')
    }
    setUploadingCover(false)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const handleRemoveCover = async () => {
    setCoverImage('')
    try {
      const updated = await updateTicket(ticket.id, { cover_image_url: null, cover_thumb_url: null })
      onUpdate(updated)
    } catch (err) {
      logger.error('CardDetail', 'Falha ao remover capa', { error: String(err) })
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}?ticket=${ticket.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: ticket.title, url })
      } else {
        await navigator.clipboard.writeText(url)
      }
    } catch {
      // ignored
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este cartao?')) return
    await deleteTicket(ticket.id)
    onDelete(ticket.id)
    handleClose()
  }

  const feedItems = useMemo(() => {
    const commentItems = comments.map(c => ({ type: 'comment' as const, id: c.id, user: c.user_name, text: c.content, time: c.created_at }))
    const activityItems = activities.map(a => ({ type: 'activity' as const, id: a.id, user: a.user_name, text: a.action_text, time: a.created_at }))
    const all = timelineFilter === 'comments'
      ? commentItems
      : timelineFilter === 'activity'
      ? activityItems
      : [...commentItems, ...activityItems]
    return all.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }, [comments, activities, timelineFilter])

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[60] flex items-center justify-center modal-overlay ${isVisible ? 'modal-overlay--visible' : ''}`}
      style={{ background: 'rgba(0,0,10,0.85)' }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div
        ref={modalRef}
        className={`elite-modal modal-content ${isVisible ? 'modal-content--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
      >
        {/* ── Cover image banner ── */}
        {coverImage && (
          <div className="relative w-full h-[100px] overflow-hidden flex-shrink-0" style={{ background: '#010d1a' }}>
            <img
              src={coverImage}
              alt=""
              className="w-full h-full object-cover"
              onError={(ev) => {
                const src = ev.currentTarget.src
                logger.warn('CardDetail', 'Cover image load failed', { src })
                // Nunca limpar blob preview (sempre carrega) nem durante upload
                if (!src.startsWith('blob:') && !uploadingCover) setCoverImage('')
              }}
            />
            <div className="absolute bottom-2 right-2 flex gap-1">
              <button onClick={() => coverInputRef.current?.click()} className="px-2.5 py-1 rounded-md text-xs font-semibold backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)', color: '#b6c2cf' }}>Alterar capa</button>
              <button onClick={handleRemoveCover} className="px-2.5 py-1 rounded-md text-xs font-semibold backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)', color: '#f87171' }}>Remover</button>
            </div>
          </div>
        )}
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />

        {/* ── Top bar ── */}
        <div className="elite-modal__topbar">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CreditCard size={18} style={{ color: '#596773' }} />
            <input
              id="card-detail-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="bg-transparent border-none outline-none text-base leading-tight font-bold w-full"
              style={{ color: '#b6c2cf' }}
            />
            <span className="text-xs whitespace-nowrap" style={{ color: '#596773' }}>
              {statusLabel(status)}
            </span>
          </div>
          <div className="flex items-center gap-1 relative flex-shrink-0">
            <select
              value={status}
              onChange={async e => {
                const next = e.target.value as TicketStatus
                const oldLabel = statusLabel(status)
                const newLabel = statusLabel(next)
                setStatus(next)
                await save({ status: next })
                await insertActivityLog(ticket.id, user, `moveu este cartao de ${oldLabel} para ${newLabel}`, ticket.department_id)
              }}
              className="dark-select"
            >
              {boardColumns.length > 0
                ? boardColumns.map(col => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))
                : (Object.entries(LEGACY_STATUS_MAP) as [string, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))
              }
            </select>
            <button onClick={(e) => { e.stopPropagation(); setShowMoreMenu(prev => !prev) }} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" style={{ color: '#596773' }} title="Mais opcoes"><MoreHorizontal size={16} /></button>
            <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" style={{ color: '#596773' }}><X size={18} /></button>

            {showMoreMenu && (
              <div className="absolute right-10 top-10 w-44 rounded-lg overflow-hidden z-20" style={{ background: '#282e33', border: '1px solid rgba(166,197,226,0.16)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()}>
                <button onClick={async () => { setShowMoreMenu(false); await handleShare() }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/10 transition-colors" style={{ color: '#b6c2cf' }}>Compartilhar</button>
                <button onClick={async () => { setShowMoreMenu(false); await handleSaveAll() }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/10 transition-colors" style={{ color: '#b6c2cf' }}>Salvar agora</button>
                <button onClick={async () => { setShowMoreMenu(false); await handleDelete() }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-red-500/20 transition-colors" style={{ color: '#f87171' }}>Excluir cartao</button>
                <button onClick={() => { setShowMoreMenu(false); handleClose() }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/10 transition-colors" style={{ color: '#596773' }}>Fechar</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Action quick bar ── */}
        <div className="flex items-center gap-1.5 px-5 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setShowLabelPicker(p => !p)} className="elite-action-chip" style={showLabelPicker ? { borderColor: 'rgba(87,157,255,0.5)', color: '#579dff' } : {}}>Etiquetas</button>
          <button onClick={() => setShowDatePicker(p => !p)} className="elite-action-chip" style={showDatePicker ? { borderColor: 'rgba(87,157,255,0.5)', color: '#579dff' } : {}}>Datas</button>
          <button onClick={() => setShowChecklist(p => !p)} className="elite-action-chip" style={showChecklist ? { borderColor: 'rgba(87,157,255,0.5)', color: '#579dff' } : {}}>Checklist</button>
          {!coverImage && <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="elite-action-chip">{uploadingCover ? 'Enviando...' : 'Capa'}</button>}
          <button onClick={() => setShowMemberPicker(p => !p)} className="elite-action-chip" style={showMemberPicker ? { borderColor: 'rgba(87,157,255,0.5)', color: '#579dff' } : {}}>
            <Link2 size={11} className="inline mr-1" style={{ verticalAlign: '-1px' }} />Vincular
          </button>
        </div>

        {/* ── Creation info ── */}
        <div className="flex items-center gap-3 px-5 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#596773' }}>
            <User size={12} />
            <span>Criado por <strong style={{ color: '#8c9bab' }}>{(() => {
              const raw = ticket.assignee || ''
              if (!raw) return 'Desconhecido'
              const first = raw.split(',')[0].trim()
              const profile = allUsers.find(u => u.email === first || u.name === first)
              return profile?.name || (first.includes('@') ? first.split('@')[0] : first)
            })()}</strong></span>
          </div>
          <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)' }} />
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#596773' }}>
            <Calendar size={12} />
            <span>{new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} às {new Date(ticket.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* ── Tri-column body ── */}
        <div className="elite-modal__body">
          {/* ═══ LEFT: Identification ═══ */}
          <div className="elite-modal__col-left">
            {/* Labels picker */}
            {showLabelPicker && (
              <div className="rounded-lg p-2.5 space-y-2 mb-3" style={{ background: '#22272b', border: '1px solid rgba(166,197,226,0.12)', maxHeight: 260, overflowY: 'auto' }}>
                <div className="text-[11px] font-semibold" style={{ color: '#596773' }}>Etiquetas</div>

                {/* Applied tags inline */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((raw) => {
                      const { name, color } = parseTag(raw);
                      return (
                        <span key={raw} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white cursor-pointer hover:opacity-75"
                          style={{ background: color }}
                          onClick={() => { const next = tags.filter(t => t !== raw); setTags(next); save({ tags: next }) }}
                          title="Clique para remover"
                        >{name} ×</span>
                      );
                    })}
                  </div>
                )}

                {/* Board labels list (selectable) */}
                {boardLabels.length > 0 && !editingLabelId && (
                  <div className="space-y-0.5">
                    {boardLabels.map(label => {
                      const encoded = `${label.name}|${label.color}`;
                      const isApplied = tags.includes(encoded);
                      return (
                        <div key={label.id} className="flex items-center gap-1.5 group">
                          <button
                            type="button"
                            className="flex-1 flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold text-white text-left hover:opacity-85 transition-opacity"
                            style={{ background: label.color }}
                            onClick={() => {
                              const next = isApplied ? tags.filter(t => t !== encoded) : [...tags, encoded];
                              setTags(next); save({ tags: next });
                            }}
                          >
                            {isApplied && <Check size={12} strokeWidth={3} />}
                            <span className="flex-1 truncate">{label.name}</span>
                          </button>
                          <button
                            type="button"
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                            onClick={() => { setEditingLabelId(label.id); setEditingLabelName(label.name); setEditingLabelColor(label.color) }}
                            title="Editar etiqueta"
                          >
                            <Pencil size={11} style={{ color: '#9fadbc' }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Edit label form */}
                {editingLabelId && (
                  <div className="space-y-1.5 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-[10px] font-semibold" style={{ color: '#596773' }}>Editar etiqueta</div>
                    <input value={editingLabelName} onChange={e => setEditingLabelName(e.target.value)} className="modal-field text-xs w-full" placeholder="Nome..." />
                    <div className="flex flex-wrap gap-1">
                      {TAG_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setEditingLabelColor(c)}
                          className="rounded-full" style={{ width: 18, height: 18, background: c, border: editingLabelColor === c ? '2px solid #fff' : '2px solid transparent' }} />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={async () => {
                        if (!editingLabelName.trim()) return;
                        await updateBoardLabel(editingLabelId, { name: editingLabelName.trim(), color: editingLabelColor });
                        // Update tag in card if it was applied
                        const oldLabel = boardLabels.find(l => l.id === editingLabelId);
                        if (oldLabel) {
                          const oldEncoded = `${oldLabel.name}|${oldLabel.color}`;
                          const newEncoded = `${editingLabelName.trim()}|${editingLabelColor}`;
                          if (tags.includes(oldEncoded)) {
                            const next = tags.map(t => t === oldEncoded ? newEncoded : t);
                            setTags(next); save({ tags: next });
                          }
                        }
                        setBoardLabels(await fetchBoardLabels());
                        setEditingLabelId(null);
                      }} className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: 'rgba(87,157,255,0.18)', color: '#579dff' }}>Salvar</button>
                      <button type="button" onClick={async () => {
                        if (confirm('Excluir esta etiqueta do board?')) {
                          const oldLabel = boardLabels.find(l => l.id === editingLabelId);
                          if (oldLabel) {
                            const encoded = `${oldLabel.name}|${oldLabel.color}`;
                            if (tags.includes(encoded)) { const next = tags.filter(t => t !== encoded); setTags(next); save({ tags: next }); }
                          }
                          await deleteBoardLabel(editingLabelId);
                          setBoardLabels(await fetchBoardLabels());
                          setEditingLabelId(null);
                        }
                      }} className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef5c48' }}>Excluir</button>
                      <button type="button" onClick={() => setEditingLabelId(null)} className="px-2 py-1 rounded text-[10px] font-semibold" style={{ color: '#596773' }}>Cancelar</button>
                    </div>
                  </div>
                )}


              </div>
            )}

            {/* Date picker */}
            {showDatePicker && (
              <div className="rounded-lg p-3 space-y-2 mb-3" style={{ background: '#22272b', border: '1px solid rgba(166,197,226,0.12)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: '#596773' }}>Data de entrega</div>
                <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); save({ due_date: e.target.value || null }) }} className="modal-field text-sm" />
                {dueDate && <div className="text-xs" style={{ color: '#596773' }}>Entrega: {new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <FieldGroup label="Cliente" icon={<User size={13} />}>
                <input value={cliente} onChange={e => setCliente(e.target.value)} onBlur={saveOnBlur} className="modal-field" placeholder="Nome do cliente" />
              </FieldGroup>
              <FieldGroup label="Instância" icon={<CreditCard size={13} />}>
                <input value={instancia} onChange={e => setInstancia(e.target.value)} onBlur={saveOnBlur} className="modal-field" placeholder="Código da instância" />
              </FieldGroup>
              <FieldGroup label="Link Retaguarda" icon={<Link2 size={13} />}>
                <div className="flex gap-1">
                  <input value={linkRetaguarda} onChange={e => setLinkRetaguarda(e.target.value)} onBlur={saveOnBlur} className="modal-field flex-1" placeholder="URL" />
                  {linkRetaguarda && (
                    <a href={linkRetaguarda} target="_blank" rel="noreferrer" className="modal-field-icon-btn" title="Abrir link"><ExternalLink size={12} /></a>
                  )}
                </div>
              </FieldGroup>
              <FieldGroup label="Link Sessão" icon={<Link2 size={13} />}>
                <div className="flex gap-1">
                  <input value={linkSessao} onChange={e => setLinkSessao(e.target.value)} onBlur={saveOnBlur} className="modal-field flex-1" placeholder="URL" />
                  {linkSessao && (
                    <a href={linkSessao} target="_blank" rel="noreferrer" className="modal-field-icon-btn" title="Abrir link"><ExternalLink size={12} /></a>
                  )}
                </div>
              </FieldGroup>
            </div>

            {/* Attachments */}
            <CardAttachments ticketId={ticket.id} ticketDepartmentId={ticket.department_id} user={user} />
          </div>

          {/* ═══ CENTER: Actions & Status ═══ */}
          <div className="elite-modal__col-center">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <FieldGroup label="Prioridade">
                <select value={priority} onChange={async e => { const next = e.target.value as Ticket['priority']; setPriority(next); await save({ priority: next }) }} className="modal-field">
                  <option value="low">Baixa</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Vinculados">
                <div className="flex flex-wrap gap-1">
                  {members.map(m => {
                    const profile = allUsers.find(u => u.email === m || u.name === m)
                    const displayName = profile?.name || (m.includes('@') ? m.split('@')[0] : m)
                    return (
                    <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(87,157,255,0.15)', color: '#579dff' }}>
                      {displayName}
                      <button onClick={() => { const next = members.filter(x => x !== m); setMembers(next); const joined = next.join(', '); setAssignee(joined); save({ assignee: joined || null }) }} className="hover:text-red-400 transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                    )
                  })}
                  {members.length === 0 && <span className="text-[11px]" style={{ color: '#596773' }}>Nenhum</span>}
                </div>
                {showMemberPicker && (
                  <div className="mt-2 rounded-lg p-2 space-y-1" style={{ background: '#1d2125', border: '1px solid rgba(166,197,226,0.12)', maxHeight: 180, overflowY: 'auto' }}>
                    {allUsers.length === 0 && <div className="text-[11px] py-2 text-center" style={{ color: '#596773' }}>Carregando...</div>}
                    {allUsers.map(u => {
                      const isAdded = members.some(m => m === u.email || m === u.name)
                      return (
                        <button
                          key={u.email}
                          onClick={async () => {
                            let next: string[]
                            if (isAdded) {
                              next = members.filter(m => m !== u.email && m !== u.name)
                            } else {
                              next = [...members, u.email]
                              // Notificar o membro adicionado
                              if (u.email.toLowerCase() !== user.toLowerCase()) {
                                const { data: { session } } = await supabase.auth.getSession()
                                const fullName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || ''
                                const firstName = fullName ? fullName.split(' ')[0] : user.split('@')[0]
                                const senderDisplayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
                                insertNotification({
                                  department_id: ticket.department_id || '',
                                  recipient_email: u.email,
                                  sender_name: senderDisplayName,
                                  type: 'assignment',
                                  ticket_id: ticket.id,
                                  ticket_title: ticket.title,
                                  message: `vinculou você ao cartão "${ticket.title.length > 60 ? ticket.title.slice(0, 60) + '…' : ticket.title}"`,
                                })
                              }
                            }
                            setMembers(next)
                            const joined = next.join(', ')
                            setAssignee(joined)
                            save({ assignee: joined || null })
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-white/5"
                        >
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: u.avatar_color || '#579dff' }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="flex-1 text-[11px] truncate" style={{ color: '#b6c2cf' }}>{u.name}</span>
                          {isAdded && <Check size={12} style={{ color: '#22c55e' }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </FieldGroup>
            </div>

            <section>
              <div className="flex items-center gap-2 mb-1 text-xs font-semibold" style={{ color: '#b6c2cf' }}>
                <AlignLeft size={14} style={{ color: '#25D066' }} />
                Descrição
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={saveOnBlur}
                className="w-full rounded-md p-3 text-sm resize-y outline-none"
                style={{ background: '#22272b', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.16)', minHeight: 60 }}
                placeholder="Adicione uma descrição mais detalhada..."
              />
            </section>

            {/* Checklist */}
            {showChecklist && (() => {
              const lines = observacao.split('\n')
              const checkItems = lines
                .map((line, idx) => ({ idx, text: line.replace(/^[☐☑]\s*/, ''), checked: line.startsWith('☑'), isCheck: line.startsWith('☐') || line.startsWith('☑') }))
                .filter(i => i.isCheck)
              const doneCount = checkItems.filter(i => i.checked).length
              const totalCount = checkItems.length
              const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

              const toggleItem = (lineIdx: number) => {
                const updated = lines.map((line, i) => {
                  if (i !== lineIdx) return line
                  return line.startsWith('☐') ? line.replace('☐', '☑') : line.replace('☑', '☐')
                }).join('\n')
                setObservacao(updated)
                save({ observacao: updated })
              }

              const removeItem = (lineIdx: number) => {
                const updated = lines.filter((_, i) => i !== lineIdx).join('\n')
                setObservacao(updated)
                save({ observacao: updated })
              }

              const addItem = () => {
                if (!newChecklistItem.trim()) return
                const item = '☐ ' + newChecklistItem.trim()
                const updated = observacao ? observacao + '\n' + item : item
                setObservacao(updated)
                save({ observacao: updated })
                setNewChecklistItem('')
                checklistInputRef.current?.focus()
              }

              return (
                <section className="mt-3">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold" style={{ color: '#b6c2cf' }}>
                    <CheckSquare size={14} style={{ color: '#596773' }} />
                    Checklist
                    {totalCount > 0 && <span className="ml-auto text-[10px] font-normal" style={{ color: '#596773' }}>{doneCount}/{totalCount}</span>}
                  </div>
                  {totalCount > 0 && (
                    <div className="rounded-full overflow-hidden mb-2" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : '#579dff', transition: 'width 0.3s ease' }} />
                    </div>
                  )}
                  <div className="space-y-1 mb-2">
                    {checkItems.map(item => (
                      <div key={item.idx} className="flex items-center gap-2 group rounded-md px-2 py-1.5 transition-colors hover:bg-white/5" style={{ cursor: 'pointer' }}>
                        <button onClick={() => toggleItem(item.idx)} className="flex-shrink-0" style={{ color: item.checked ? '#22c55e' : '#596773' }}>
                          {item.checked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                        <span className="flex-1 text-sm" style={{ color: item.checked ? '#596773' : '#b6c2cf', textDecoration: item.checked ? 'line-through' : 'none' }}>{item.text}</span>
                        <button onClick={() => removeItem(item.idx)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20">
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      ref={checklistInputRef}
                      value={newChecklistItem}
                      onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addItem() }}
                      placeholder="Adicionar item..."
                      className="modal-field flex-1 text-xs"
                    />
                    <button onClick={addItem} className="px-2 py-1 rounded-md transition-colors hover:bg-white/10" style={{ color: '#579dff' }}>
                      <Plus size={16} />
                    </button>
                  </div>
                </section>
              )
            })()}

            <section className="mt-3">
              <div className="flex items-center gap-2 mb-1 text-xs font-semibold" style={{ color: '#b6c2cf' }}>
                <Paperclip size={14} style={{ color: '#25D066' }} />
                Observação
              </div>
              <textarea
                value={observacao.split('\n').filter(l => !l.startsWith('☐') && !l.startsWith('☑')).join('\n')}
                onChange={e => {
                  const checkLines = observacao.split('\n').filter(l => l.startsWith('☐') || l.startsWith('☑'))
                  const newNotes = e.target.value
                  const merged = [...(newNotes ? [newNotes] : []), ...checkLines].join('\n')
                  setObservacao(merged)
                }}
                onBlur={saveOnBlur}
                className="w-full rounded-md p-3 text-sm resize-y outline-none"
                style={{ background: '#22272b', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.16)', minHeight: 80 }}
                rows={4}
                placeholder="Notas adicionais"
              />
            </section>
          </div>

          {/* ═══ RIGHT: Timeline / Activity ═══ */}
          <div className="elite-modal__col-right">

            {/* Header with tab filters */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#b6c2cf' }}>
                <MessageSquare size={14} style={{ color: '#596773' }} />
                Timeline
                <span className="text-[10px] font-normal" style={{ color: '#596773' }}>
                  ({comments.length + activities.length})
                </span>
              </div>
              <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 }}>
                {(['all', 'comments', 'activity'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTimelineFilter(f)}
                    style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: 'none',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: timelineFilter === f ? 'rgba(87,157,255,0.18)' : 'transparent',
                      color: timelineFilter === f ? '#579dff' : '#596773',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {f === 'all' ? 'Tudo' : f === 'comments' ? `Comentários${comments.length > 0 ? ` (${comments.length})` : ''}` : `Atividade${activities.length > 0 ? ` (${activities.length})` : ''}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment input - always visible */}
            <div className="flex gap-2 mb-3 flex-shrink-0">
              <Avatar name={user} size={28} />
              <div className="flex-1 relative">
                <textarea
                  ref={commentRef}
                  value={newComment}
                  onChange={e => {
                    const val = e.target.value
                    setNewComment(val)
                    const pos = e.target.selectionStart
                    const textBefore = val.slice(0, pos)
                    const atMatch = textBefore.match(/@([\w\u00C0-\u024F]*)$/)
                    if (atMatch) {
                      mentionStartPos.current = pos - atMatch[0].length
                      setMentionQuery(atMatch[1].toLowerCase())
                      setMentionIndex(0)
                    } else {
                      setMentionQuery(null)
                    }
                  }}
                  onFocus={() => setCommentFocused(true)}
                  onBlur={() => {
                    if (!newComment.trim()) setCommentFocused(false)
                    setTimeout(() => setMentionQuery(null), 150)
                  }}
                  placeholder="Escrever um comentário... Use @ para mencionar"
                  rows={commentFocused ? 3 : 1}
                  className="modal-field resize-none transition-all text-[13px]"
                  onKeyDown={e => {
                    if (mentionQuery !== null && filteredMentionUsers.length > 0) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMentionUsers.length - 1)); return }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
                      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyMention(filteredMentionUsers[mentionIndex]); return }
                      if (e.key === 'Escape') { setMentionQuery(null); return }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() }
                  }}
                />
                {/* Mention autocomplete dropdown */}
                {mentionQuery !== null && filteredMentionUsers.length > 0 && (
                  <div className="mention-dropdown">
                    {filteredMentionUsers.map((u, i) => (
                      <div
                        key={u.email}
                        className={`mention-dropdown__item ${i === mentionIndex ? 'mention-dropdown__item--active' : ''}`}
                        onMouseDown={e => { e.preventDefault(); applyMention(u) }}
                        onMouseEnter={() => setMentionIndex(i)}
                      >
                        <div className="mention-dropdown__avatar" style={{ background: u.avatar_color }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="mention-dropdown__info">
                          <span className="mention-dropdown__name">{u.name}</span>
                          <span className="mention-dropdown__email">{u.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <AnimatePresence>
                  {(commentFocused || newComment.trim()) && (
                    <div className="flex items-center justify-between mt-1.5">
                      <button
                        onClick={() => setIsInternalNote(p => !p)}
                        type="button"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                          borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: isInternalNote ? 'rgba(245,166,35,0.12)' : 'transparent',
                          border: isInternalNote ? '1px solid rgba(245,166,35,0.3)' : '1px solid rgba(255,255,255,0.08)',
                          color: isInternalNote ? '#f5a623' : '#596773',
                          cursor: 'pointer', transition: 'all 0.15s',
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                        title="Nota interna (não visível ao cliente)"
                      >
                        <Lock size={10} />
                        {isInternalNote ? 'Nota Interna' : 'Público'}
                      </button>
                      <button onClick={handleSendComment} disabled={!newComment.trim() || sendingComment}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-40"
                        style={{ background: isInternalNote ? '#f5a623' : '#3b82f6' }}>
                        {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        {isInternalNote ? 'Nota' : 'Enviar'}
                      </button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Divider before feed */}
            {feedItems.length > 0 && (
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 10, flexShrink: 0 }} />
            )}

            {/* Feed - always rendered, filtered by tab */}
            <div className="elite-modal__feed">
              {feedItems.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#596773' }}>
                  <MessageSquare size={22} style={{ margin: '0 auto 8px', opacity: 0.35 }} />
                  <p style={{ fontSize: 12 }}>
                    {timelineFilter === 'comments' ? 'Nenhum comentário ainda.' : timelineFilter === 'activity' ? 'Nenhuma atividade registrada.' : 'Nenhuma atividade ainda.'}
                  </p>
                </div>
              ) : (
                feedItems.map(item => (
                  <div key={item.id} className="flex gap-2 group" style={{ marginBottom: 12 }}>
                    <Avatar name={item.user} size={24} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold" style={{ color: '#b6c2cf' }}>
                          {item.user.includes('@') ? item.user.split('@')[0] : item.user}
                        </span>
                        <span className="text-[10px]" style={{ color: '#596773' }}>{timeAgo(item.time)}</span>
                        {item.type === 'activity' && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                            background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}>ATIVIDADE</span>
                        )}
                      </div>
                      {item.type === 'comment' ? (
                        <>
                          {item.text.startsWith('[INTERNO] ') && (
                            <div className="flex items-center gap-1 mt-0.5 mb-0.5">
                              <Lock size={9} style={{ color: '#f5a623' }} />
                              <span style={{ color: '#f5a623', fontSize: 9, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>NOTA INTERNA</span>
                            </div>
                          )}
                          <div className="mt-0.5 rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed" style={{
                            background: item.text.startsWith('[INTERNO] ') ? 'rgba(245,166,35,0.08)' : '#22272b',
                            color: '#b6c2cf',
                            border: item.text.startsWith('[INTERNO] ') ? '1px solid rgba(245,166,35,0.2)' : '1px solid rgba(166,197,226,0.08)',
                          }}>
                            {renderCommentText(item.text.startsWith('[INTERNO] ') ? item.text.slice(10) : item.text)}
                          </div>
                          <button onClick={() => handleDeleteComment(item.id)} className="mt-0.5 text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400" style={{ color: '#596773' }}>
                            <Trash2 size={9} /> Excluir
                          </button>
                        </>
                      ) : (
                        <div className="mt-0.5 text-[12px] flex items-center gap-1.5" style={{ color: '#596773' }}>
                          <ArrowRight size={10} style={{ color: '#579dff' }} />
                          {item.text}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>
          </div>
        </div>

        {/* ── Footer with glass effect ── */}
        <div className="elite-modal__footer">
          <button onClick={handleSaveAll} disabled={(!hasPendingChanges() && !saveSuccess) || saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
            style={saveSuccess
              ? { background: 'rgba(75,206,151,0.18)', color: '#4bce97', border: '1px solid rgba(75,206,151,0.24)' }
              : { background: 'rgba(96,165,250,0.18)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.24)' }
            }>
            {saving ? 'Salvando...' : saveSuccess ? <><Check size={12} className="inline mr-1" />Salvo!</> : 'Salvar'}
          </button>
          <button onClick={handleDelete}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: 'rgba(239,68,68,0.14)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(name || 'U') }}
    >
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  )
}

function FieldGroup({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="relative">
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#b6c2cf' }}>
        {icon && <span style={{ color: '#25D066' }}>{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  )
}
