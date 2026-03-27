import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MessageSquare, Trash2, Send, Loader2, Download, Video, FileText,
  ChevronDown, ArrowRight, Image as ImageIcon, ExternalLink, Save
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  supabase, updateTicket, deleteTicket,
  fetchComments, insertComment, deleteComment,
  fetchAttachments, uploadAttachment, deleteAttachment,
  fetchActivityLog, insertActivityLog
} from '../lib/supabase'
import type { Ticket, TicketStatus, Comment, Attachment, ActivityLog } from '../lib/supabase'

interface CardDetailModalProps {
  ticket: Ticket
  user: string
  onClose: () => void
  onUpdate: (ticket: Ticket) => void
  onDelete: (id: string) => void
}

const STATUS_MAP: Record<TicketStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'Em andamento',
  waiting_devs: 'Aguardando Devs',
  resolved: 'Concluído',
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  backlog: '#9ca3af',
  in_progress: '#25D066',
  waiting_devs: '#fbbf24',
  resolved: '#1BAD53',
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `há ${days}d`
  if (hrs > 0) return `há ${hrs}h`
  if (mins > 0) return `há ${mins} minutos`
  return 'há pouco'
}

const avatarPalette = ['#25D066', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899']
function avatarColor(name: string) {
  return avatarPalette[name.charCodeAt(0) % avatarPalette.length]
}

export default function CardDetailModal({ ticket, user, onClose, onUpdate, onDelete }: CardDetailModalProps) {
  // --- State ---
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

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [commentFocused, setCommentFocused] = useState(false)

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)

  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [showDetails, setShowDetails] = useState(true)
  const [showActivities, setShowActivities] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // --- Load data ---
  useEffect(() => {
    fetchComments(ticket.id).then(setComments)
    fetchAttachments(ticket.id).then(setAttachments)
    fetchActivityLog(ticket.id).then(setActivities)
  }, [ticket.id])

  // --- Realtime for comments & activity ---
  useEffect(() => {
    const ch = supabase
      .channel(`modal-${ticket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticket.id}` }, p => {
        setComments(prev => prev.some(c => c.id === (p.new as Comment).id) ? prev : [...prev, p.new as Comment])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticket.id}` }, p => {
        setComments(prev => prev.filter(c => c.id !== (p.old as any).id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `card_id=eq.${ticket.id}` }, p => {
        setActivities(prev => prev.some(a => a.id === (p.new as ActivityLog).id) ? prev : [...prev, p.new as ActivityLog])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [ticket.id])

  // Scroll to latest comment
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // --- Save helper ---
  const save = useCallback(async (updates: Partial<Ticket>) => {
    setSaving(true)
    try {
      const updated = await updateTicket(ticket.id, updates)
      onUpdate(updated)
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }, [ticket.id, onUpdate])

  // --- Save all fields ---
  const handleSaveAll = async () => {
    const updates: Partial<Ticket> = {}
    if (title.trim() && title !== ticket.title) updates.title = title.trim()
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
        const oldLabel = STATUS_MAP[ticket.status]
        const newLabel = STATUS_MAP[updates.status]
        await insertActivityLog(ticket.id, user, `moveu este cartão de ${oldLabel} para ${newLabel}`)
        fetchActivityLog(ticket.id).then(setActivities)
      }
    }
  }

  // --- Handlers ---
  const handleTitleBlur = () => {
    if (title.trim() && title !== ticket.title) save({ title: title.trim() })
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    setStatus(newStatus)
  }

  const handleSendComment = async () => {
    if (!newComment.trim()) return
    setSendingComment(true)
    const c = await insertComment(ticket.id, user, newComment.trim())
    if (c) setComments(prev => [...prev, c])
    setNewComment('')
    setSendingComment(false)
    commentRef.current?.focus()
  }

  const handleDeleteComment = async (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id))
    await deleteComment(id)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const att = await uploadAttachment(ticket.id, file, user)
      if (att) setAttachments(prev => [...prev, att])
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteAttachment = async (att: Attachment) => {
    setAttachments(prev => prev.filter(a => a.id !== att.id))
    await deleteAttachment(att.id, att.file_url)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}?ticket=${ticket.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: ticket.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        alert('Link copiado para a área de transferência!')
      }
    } catch { /* cancelled */ }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este cartão?')) return
    await deleteTicket(ticket.id)
    onDelete(ticket.id)
    onClose()
  }

  // --- Merge comments + activities for feed ---
  const feedItems = [
    ...comments.map(c => ({ type: 'comment' as const, id: c.id, user: c.user_name, text: c.content, time: c.created_at })),
    ...(showActivities ? activities.map(a => ({ type: 'activity' as const, id: a.id, user: a.user_name, text: a.action_text, time: a.created_at })) : []),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[520px] my-12 mx-4 rounded-xl overflow-hidden shadow-2xl"
        style={{ background: '#1e1f23', color: '#c8cad0' }}
      >
        {/* ===== HEADER ===== */}
        <div className="relative px-6 pt-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: '#c8cad0' }}>Editar Ticket</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: '#9fadbc' }}>
            <X size={20} />
          </button>
        </div>

        {/* ===== FORM BODY ===== */}
        <div className="px-6 pb-6 space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto modal-scroll">

          {/* Título */}
          <FieldGroup label="Título">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="modal-field"
              placeholder="Título do ticket..."
            />
          </FieldGroup>

          {/* Cliente + Instância (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Cliente">
              <input
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                className="modal-field"
                placeholder="Nome do cliente..."
              />
            </FieldGroup>
            <FieldGroup label="Instância">
              <input
                value={instancia}
                onChange={e => setInstancia(e.target.value)}
                className="modal-field"
                placeholder="Código da instância..."
              />
            </FieldGroup>
          </div>

          {/* Prioridade + Coluna (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Prioridade">
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Ticket['priority'])}
                className="modal-field"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Coluna">
              <select
                value={status}
                onChange={e => handleStatusChange(e.target.value as TicketStatus)}
                className="modal-field"
              >
                {(Object.entries(STATUS_MAP) as [TicketStatus, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </FieldGroup>
          </div>

          {/* Link de Retaguarda */}
          <FieldGroup label="Link de Retaguarda">
            <div className="flex gap-2">
              <input
                value={linkRetaguarda}
                onChange={e => setLinkRetaguarda(e.target.value)}
                className="modal-field flex-1"
                placeholder="URL do sistema de retaguarda..."
              />
              {linkRetaguarda && (
                <a href={linkRetaguarda} target="_blank" rel="noreferrer" className="modal-field-icon-btn" title="Abrir link">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </FieldGroup>

          {/* Link de Sessão */}
          <FieldGroup label="Link de Sessão">
            <div className="flex gap-2">
              <input
                value={linkSessao}
                onChange={e => setLinkSessao(e.target.value)}
                className="modal-field flex-1"
                placeholder="URL da conversa / sessão..."
              />
              {linkSessao && (
                <a href={linkSessao} target="_blank" rel="noreferrer" className="modal-field-icon-btn" title="Abrir link">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </FieldGroup>

          {/* Problema / Descrição */}
          <FieldGroup label="Problema">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="modal-field resize-y"
              placeholder="Descreva o problema em detalhes..."
              rows={4}
            />
            {saving && (
              <div className="absolute top-2 right-3">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,208,102,0.15)', color: '#25D066' }}>Preen</span>
              </div>
            )}
          </FieldGroup>

          {/* Evidências (Fotos e Vídeos) */}
          <FieldGroup label="Evidências (Fotos e Vídeos)">
            <div className="space-y-2">
              {attachments.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {attachments.map(att => (
                    <div key={att.id} className="group relative rounded-lg overflow-hidden" style={{ background: '#22252a', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {att.file_type === 'image' ? (
                        <a href={att.file_url} target="_blank" rel="noreferrer"><img src={att.file_url} alt={att.file_name} className="w-full h-20 object-cover" /></a>
                      ) : att.file_type === 'video' ? (
                        <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-20"><Video size={20} style={{ color: '#6b7280' }} /></a>
                      ) : (
                        <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-20"><FileText size={20} style={{ color: '#6b7280' }} /></a>
                      )}
                      <div className="px-2 py-1 flex items-center justify-between">
                        <span className="text-[9px] truncate" style={{ color: '#9fadbc' }}>{att.file_name}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={att.file_url} download target="_blank" rel="noreferrer" className="p-0.5 rounded hover:bg-white/10"><Download size={10} style={{ color: '#9fadbc' }} /></a>
                          <button onClick={() => handleDeleteAttachment(att)} className="p-0.5 rounded hover:bg-red-500/20"><Trash2 size={10} className="text-red-400" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {uploading && (
                    <div className="flex items-center justify-center h-20 rounded-lg" style={{ background: '#22252a', border: '2px dashed rgba(255,255,255,0.08)' }}>
                      <Loader2 size={18} className="animate-spin" style={{ color: '#25D066' }} />
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/6"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', color: '#9fadbc' }}
              >
                <ImageIcon size={16} />
                Adicionar Foto ou Vídeo
              </button>
            </div>
          </FieldGroup>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />

          {/* Observação */}
          <FieldGroup label="Observação">
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              className="modal-field resize-y"
              placeholder="Notas adicionais sobre a evidência..."
              rows={2}
            />
          </FieldGroup>

          {/* ---- Comentários e atividade (collapsible) ---- */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-sm font-semibold transition-colors hover:text-white"
                style={{ color: '#9fadbc' }}
              >
                <MessageSquare size={16} />
                Comentários e Atividade
                <ChevronDown size={14} className={clsx('transition-transform', !showDetails && '-rotate-90')} />
              </button>
              {showDetails && (
                <button
                  onClick={() => setShowActivities(!showActivities)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                  style={{
                    background: showActivities ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.05)',
                    color: showActivities ? '#60a5fa' : '#6b7280',
                    border: `1px solid ${showActivities ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {showActivities ? 'Esconder Atividades' : 'Mostrar Detalhes'}
                </button>
              )}
            </div>

            <AnimatePresence>
              {showDetails && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  {/* Comment input */}
                  <div className="flex gap-2.5 mb-3">
                    <Avatar name={user} size={28} />
                    <div className="flex-1">
                      <textarea
                        ref={commentRef}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onFocus={() => setCommentFocused(true)}
                        onBlur={() => !newComment.trim() && setCommentFocused(false)}
                        placeholder="Escrever um comentário..."
                        rows={commentFocused ? 3 : 1}
                        className="modal-field resize-none transition-all text-[13px]"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
                      />
                      <AnimatePresence>
                        {(commentFocused || newComment.trim()) && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex justify-end mt-1.5">
                            <button onClick={handleSendComment} disabled={!newComment.trim() || sendingComment}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-40"
                              style={{ background: '#25D066' }}>
                              {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Enviar
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Feed */}
                  <div className="space-y-3 mb-2">
                    {feedItems.map(item => (
                      <div key={item.id} className="flex gap-2.5 group">
                        <Avatar name={item.user} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold" style={{ color: '#c8cad0' }}>
                              {item.user.includes('@') ? item.user.split('@')[0] : item.user}
                            </span>
                            <span className="text-[10px]" style={{ color: '#6b7280' }}>{timeAgo(item.time)}</span>
                          </div>
                          {item.type === 'comment' ? (
                            <>
                              <div className="mt-0.5 rounded-lg px-3 py-2 text-[13px] leading-relaxed" style={{ background: '#282a2e', color: '#c8cad0', border: '1px solid rgba(255,255,255,0.04)' }}>
                                {item.text}
                              </div>
                              {item.user === user && (
                                <button onClick={() => handleDeleteComment(item.id)}
                                  className="mt-0.5 text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                                  style={{ color: '#6b7280' }}>
                                  <Trash2 size={9} /> Excluir
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="mt-0.5 text-[13px] flex items-center gap-1.5" style={{ color: '#9fadbc' }}>
                              <ArrowRight size={11} style={{ color: '#25D066' }} />
                              {item.text}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {feedItems.length === 0 && (
                      <div className="text-center py-4 text-[13px]" style={{ color: '#6b7280' }}>Nenhuma atividade ainda.</div>
                    )}
                    <div ref={commentsEndRef} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ===== FOOTER: Save + Delete ===== */}
        <div className="px-6 pb-5 pt-2 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSaveAll}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60"
            style={{ background: '#25D066' }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleDelete}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white"
            style={{ background: '#ef4444' }}
          >
            Excluir
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// --- Sub-components ---

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9fadbc' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

