import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MessageSquare, Trash2, Send, Loader2, Download, Video, FileText,
  ArrowRight, Image as ImageIcon, ExternalLink, MoreHorizontal,
  AlignLeft, CreditCard, Paperclip
} from 'lucide-react'
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

const avatarPalette = ['#25D066', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899']
function avatarColor(name: string) {
  return avatarPalette[name.charCodeAt(0) % avatarPalette.length]
}

export default function CardDetailModal({ ticket, user, onClose, onUpdate, onDelete }: CardDetailModalProps) {
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
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [showActivities, setShowActivities] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

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
  }, [ticket])

  useEffect(() => {
    fetchComments(ticket.id).then(setComments)
    fetchAttachments(ticket.id).then(setAttachments)
    fetchActivityLog(ticket.id).then(setActivities)
  }, [ticket.id])

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

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length, activities.length])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  useEffect(() => {
    const closeMenu = () => setShowMoreMenu(false)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

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

  const handleSaveAll = async () => {
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
        const oldLabel = STATUS_MAP[ticket.status]
        const newLabel = STATUS_MAP[updates.status]
        await insertActivityLog(ticket.id, user, `moveu este cartao de ${oldLabel} para ${newLabel}`)
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
      }
    } catch {
      // ignored
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este cartao?')) return
    await deleteTicket(ticket.id)
    onDelete(ticket.id)
    onClose()
  }

  const feedItems = [
    ...comments.map(c => ({ type: 'comment' as const, id: c.id, user: c.user_name, text: c.content, time: c.created_at })),
    ...(showActivities ? activities.map(a => ({ type: 'activity' as const, id: a.id, user: a.user_name, text: a.action_text, time: a.created_at })) : []),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 34 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 34 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[1120px] my-10 mx-4 rounded-xl overflow-hidden shadow-2xl"
        style={{ background: '#22272b', color: '#c8cad0', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <select
              value={status}
              onChange={async e => {
                const next = e.target.value as TicketStatus
                const oldLabel = STATUS_MAP[status]
                const newLabel = STATUS_MAP[next]
                setStatus(next)
                await save({ status: next })
                await insertActivityLog(ticket.id, user, `moveu este cartao de ${oldLabel} para ${newLabel}`)
              }}
              className="rounded-md px-2.5 py-1.5 text-sm font-semibold border"
              style={{ background: '#3a3f44', color: '#dfe1e6', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              {(Object.entries(STATUS_MAP) as [TicketStatus, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 relative">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-md hover:bg-white/10 transition-colors"
                style={{ color: '#9fadbc' }}
                title="Adicionar imagem ou video"
              >
                <ImageIcon size={17} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMoreMenu(prev => !prev)
                }}
                className="p-2 rounded-md hover:bg-white/10 transition-colors"
                style={{ color: '#9fadbc' }}
                title="Mais opcoes"
              >
                <MoreHorizontal size={18} />
              </button>
              <button onClick={onClose} className="p-2 rounded-md hover:bg-white/10 transition-colors" style={{ color: '#9fadbc' }}>
                <X size={20} />
              </button>

              {showMoreMenu && (
                <div
                  className="absolute right-10 top-11 w-44 rounded-lg overflow-hidden"
                  style={{ background: '#2a2f35', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 16px 34px rgba(0,0,0,0.35)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={async () => { setShowMoreMenu(false); await handleShare() }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
                    style={{ color: '#dfe1e6' }}
                  >
                    Compartilhar
                  </button>
                  <button
                    onClick={async () => { setShowMoreMenu(false); await handleSaveAll() }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
                    style={{ color: '#dfe1e6' }}
                  >
                    Salvar agora
                  </button>
                  <button
                    onClick={async () => { setShowMoreMenu(false); await handleDelete() }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-red-500/20 transition-colors"
                    style={{ color: '#f87171' }}
                  >
                    Excluir cartao
                  </button>
                  <button
                    onClick={() => { setShowMoreMenu(false); onClose() }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
                    style={{ color: '#9fadbc' }}
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-6 space-y-6 min-w-0" style={{ background: '#22272b', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <CreditCard size={18} style={{ color: '#9fadbc' }} />
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={handleTitleBlur}
                    className="bg-transparent border-none outline-none text-[44px] leading-tight font-bold w-full"
                    style={{ color: '#dfe1e6' }}
                  />
                </div>
                <div className="text-sm" style={{ color: '#9fadbc' }}>
                  na lista <span className="font-semibold" style={{ color: '#dfe1e6' }}>{STATUS_MAP[status]}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-1.5 rounded-md text-sm font-semibold border hover:bg-white/10 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#c8cad0' }}>+ Adicionar</button>
                <button className="px-3 py-1.5 rounded-md text-sm font-semibold border hover:bg-white/10 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#c8cad0' }}>Etiquetas</button>
                <button className="px-3 py-1.5 rounded-md text-sm font-semibold border hover:bg-white/10 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#c8cad0' }}>Datas</button>
                <button className="px-3 py-1.5 rounded-md text-sm font-semibold border hover:bg-white/10 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#c8cad0' }}>Checklist</button>
                <button className="px-3 py-1.5 rounded-md text-sm font-semibold border hover:bg-white/10 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#c8cad0' }}>Membros</button>
              </div>

              <section>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold" style={{ color: '#dfe1e6' }}>
                <AlignLeft size={16} style={{ color: '#9fadbc' }} />
                Descricao
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={saveOnBlur}
                className="w-full rounded-md p-3 text-sm resize-y outline-none"
                style={{ background: '#1d2125', color: '#dfe1e6', border: '1px solid rgba(255,255,255,0.12)', minHeight: 110 }}
                placeholder="Adicione uma descricao mais detalhada..."
              />
              </section>

              <section>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold" style={{ color: '#dfe1e6' }}>
                <Paperclip size={16} style={{ color: '#9fadbc' }} />
                Campos personalizados
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldGroup label="Cliente">
                  <input value={cliente} onChange={e => setCliente(e.target.value)} onBlur={saveOnBlur} className="modal-field" placeholder="Nome do cliente" />
                </FieldGroup>
                <FieldGroup label="Instancia">
                  <input value={instancia} onChange={e => setInstancia(e.target.value)} onBlur={saveOnBlur} className="modal-field" placeholder="Codigo da instancia" />
                </FieldGroup>
                <FieldGroup label="Link de retaguarda">
                  <div className="flex gap-2">
                    <input value={linkRetaguarda} onChange={e => setLinkRetaguarda(e.target.value)} onBlur={saveOnBlur} className="modal-field flex-1" placeholder="URL do sistema" />
                    {linkRetaguarda && (
                      <a href={linkRetaguarda} target="_blank" rel="noreferrer" className="modal-field-icon-btn" title="Abrir link">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </FieldGroup>
                <FieldGroup label="Link de sessao">
                  <div className="flex gap-2">
                    <input value={linkSessao} onChange={e => setLinkSessao(e.target.value)} onBlur={saveOnBlur} className="modal-field flex-1" placeholder="URL da sessao" />
                    {linkSessao && (
                      <a href={linkSessao} target="_blank" rel="noreferrer" className="modal-field-icon-btn" title="Abrir link">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </FieldGroup>
                <FieldGroup label="Prioridade">
                  <select
                    value={priority}
                    onChange={async e => {
                      const next = e.target.value as Ticket['priority']
                      setPriority(next)
                      await save({ priority: next })
                    }}
                    className="modal-field"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </FieldGroup>
                <FieldGroup label="Membro">
                  <input value={assignee} onChange={e => setAssignee(e.target.value)} onBlur={saveOnBlur} className="modal-field" placeholder="Responsavel" />
                </FieldGroup>
                <div className="sm:col-span-2">
                  <FieldGroup label="Observacao">
                    <textarea value={observacao} onChange={e => setObservacao(e.target.value)} onBlur={saveOnBlur} className="modal-field resize-y" rows={3} placeholder="Notas adicionais" />
                  </FieldGroup>
                </div>
              </div>
              </section>

              <section>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold" style={{ color: '#dfe1e6' }}>
                <Paperclip size={16} style={{ color: '#9fadbc' }} />
                Anexos
              </div>
              <div className="space-y-2">
                {attachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {attachments.map(att => (
                      <div key={att.id} className="group relative rounded-lg overflow-hidden" style={{ background: '#1d2125', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                      <div className="flex items-center justify-center h-20 rounded-lg" style={{ background: '#1d2125', border: '2px dashed rgba(255,255,255,0.08)' }}>
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
                  Adicionar Foto ou Video
                </button>
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
              </section>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={handleSaveAll}
                  disabled={!hasPendingChanges() || saving}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-45"
                  style={{ background: 'rgba(37,208,102,0.18)', color: '#2de379', border: '1px solid rgba(37,208,102,0.24)' }}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={{ background: 'rgba(239,68,68,0.16)', color: '#f87171', border: '1px solid rgba(239,68,68,0.24)' }}
                >
                  Excluir
                </button>
              </div>
            </div>

            <div className="px-4 py-5" style={{ background: '#1d2125' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xl font-semibold" style={{ color: '#dfe1e6' }}>
                  <MessageSquare size={17} style={{ color: '#9fadbc' }} />
                  Comentarios e atividade
                </div>
                <button
                  onClick={() => setShowActivities(!showActivities)}
                  className="text-sm font-semibold px-3 py-1.5 rounded-md transition-colors"
                  style={{
                    background: showActivities ? 'rgba(255,255,255,0.08)' : 'rgba(59,130,246,0.12)',
                    color: showActivities ? '#dfe1e6' : '#60a5fa',
                  }}
                >
                  Mostrar Detalhes
                </button>
              </div>

              <div className="flex gap-2.5 mb-3">
                <Avatar name={user} size={32} />
                <div className="flex-1">
                  <textarea
                    ref={commentRef}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onFocus={() => setCommentFocused(true)}
                    onBlur={() => !newComment.trim() && setCommentFocused(false)}
                    placeholder="Escrever um comentario..."
                    rows={commentFocused ? 3 : 1}
                    className="modal-field resize-none transition-all text-[14px]"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
                  />
                  <AnimatePresence>
                    {(commentFocused || newComment.trim()) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex justify-end mt-1.5">
                        <button
                          onClick={handleSendComment}
                          disabled={!newComment.trim() || sendingComment}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-40"
                          style={{ background: '#25D066' }}
                        >
                          {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Enviar
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
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
                          <div className="mt-0.5 rounded-lg px-3 py-2 text-[13px] leading-relaxed" style={{ background: '#1d2125', color: '#c8cad0', border: '1px solid rgba(255,255,255,0.04)' }}>
                            {item.text}
                          </div>
                          {item.user === user && (
                            <button onClick={() => handleDeleteComment(item.id)} className="mt-0.5 text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400" style={{ color: '#6b7280' }}>
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
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
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

