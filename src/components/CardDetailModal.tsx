import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageSquare, Paperclip, Image, Share2, Calendar, Users, Tag, ChevronDown, Send, Trash2, Download, AlignLeft, Loader2, Plus, Video, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase, updateTicket, deleteTicket, fetchComments, insertComment, deleteComment, fetchAttachments, uploadAttachment, deleteAttachment } from '../lib/supabase'
import type { Ticket, TicketStatus, Comment, Attachment } from '../lib/supabase'

interface CardDetailModalProps {
  ticket: Ticket
  user: string
  onClose: () => void
  onUpdate: (ticket: Ticket) => void
  onDelete: (id: string) => void
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'Em andamento',
  waiting_devs: 'Aguardando Devs',
  resolved: 'Concluído',
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  backlog: '#D1D1D5',
  in_progress: '#25D066',
  waiting_devs: '#fbbf24',
  resolved: '#1BAD53',
}

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',  bg: 'rgba(239,68,68,0.15)',  color: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
  medium: { label: 'Média', bg: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: 'rgba(245,158,11,0.3)' },
  low:    { label: 'Baixa', bg: 'rgba(34,197,94,0.15)',  color: '#86efac', border: 'rgba(34,197,94,0.3)' },
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d atrás`
  if (hours > 0) return `${hours}h atrás`
  if (minutes > 0) return `${minutes}m atrás`
  return 'Agora'
}

export default function CardDetailModal({ ticket, user, onClose, onUpdate, onDelete }: CardDetailModalProps) {
  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description || '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [priority, setPriority] = useState(ticket.priority)
  const [assignee, setAssignee] = useState(ticket.assignee || '')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'details'>('comments')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  // Load comments and attachments
  useEffect(() => {
    fetchComments(ticket.id).then(setComments)
    fetchAttachments(ticket.id).then(setAttachments)
  }, [ticket.id])

  // Realtime subscriptions for comments
  useEffect(() => {
    const channel = supabase
      .channel(`card-detail-${ticket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticket.id}` }, payload => {
        setComments(prev => {
          if (prev.some(c => c.id === (payload.new as Comment).id)) return prev
          return [...prev, payload.new as Comment]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticket.id}` }, payload => {
        setComments(prev => prev.filter(c => c.id !== (payload.old as any).id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attachments', filter: `ticket_id=eq.${ticket.id}` }, payload => {
        setAttachments(prev => {
          if (prev.some(a => a.id === (payload.new as Attachment).id)) return prev
          return [...prev, payload.new as Attachment]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attachments', filter: `ticket_id=eq.${ticket.id}` }, payload => {
        setAttachments(prev => prev.filter(a => a.id !== (payload.old as any).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [ticket.id])

  // Save ticket changes
  const saveTicket = useCallback(async (updates: Partial<Ticket>) => {
    setSaving(true)
    try {
      const updated = await updateTicket(ticket.id, updates)
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to update ticket:', err)
    }
    setSaving(false)
  }, [ticket.id, onUpdate])

  const handleTitleSave = () => {
    setEditingTitle(false)
    if (title.trim() && title !== ticket.title) {
      saveTicket({ title: title.trim() })
    }
  }

  const handleDescSave = () => {
    setEditingDesc(false)
    if (description !== ticket.description) {
      saveTicket({ description })
    }
  }

  const handleStatusChange = (newStatus: TicketStatus) => {
    setStatus(newStatus)
    setShowStatusMenu(false)
    saveTicket({ status: newStatus })
  }

  const handlePriorityChange = (newPriority: typeof priority) => {
    setPriority(newPriority)
    setShowPriorityMenu(false)
    saveTicket({ priority: newPriority })
  }

  const handleAssigneeSave = () => {
    if (assignee !== (ticket.assignee || '')) {
      saveTicket({ assignee: assignee || null })
    }
  }

  // Comments
  const handleSendComment = async () => {
    if (!newComment.trim()) return
    setSendingComment(true)
    const comment = await insertComment(ticket.id, user, newComment.trim())
    if (comment) {
      setComments(prev => [...prev, comment])
      setNewComment('')
    }
    setSendingComment(false)
    commentInputRef.current?.focus()
  }

  const handleDeleteComment = async (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id))
    await deleteComment(id)
  }

  // Attachments
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const attachment = await uploadAttachment(ticket.id, file, user)
      if (attachment) {
        setAttachments(prev => [...prev, attachment])
      }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteAttachment = async (att: Attachment) => {
    setAttachments(prev => prev.filter(a => a.id !== att.id))
    await deleteAttachment(att.id, att.file_url)
  }

  // Share
  const handleShare = async () => {
    const url = `${window.location.origin}?ticket=${ticket.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: ticket.title, text: `Ticket: ${ticket.title}`, url })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copiado!')
    }
  }

  // Delete ticket
  const handleDeleteTicket = async () => {
    if (!confirm('Tem certeza que deseja excluir este ticket?')) return
    try {
      await deleteTicket(ticket.id)
      onDelete(ticket.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete ticket:', err)
    }
  }

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const priorityCfg = PRIORITY_CONFIG[priority]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center pt-12 pb-8 px-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 24 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            {/* Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: STATUS_COLORS[status] + '22', color: STATUS_COLORS[status], border: `1px solid ${STATUS_COLORS[status]}44` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                {STATUS_LABELS[status]}
                <ChevronDown size={12} />
              </button>
              {showStatusMenu && (
                <div className="absolute top-full left-0 mt-1 z-10 rounded-xl overflow-hidden py-1 min-w-[180px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
                  {(Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([key, label]) => (
                    <button key={key} onClick={() => handleStatusChange(key)}
                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-white/5"
                      style={{ color: status === key ? STATUS_COLORS[key] : 'var(--text-secondary)' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[key] }} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>#{ticket.id.slice(-6).toUpperCase()}</span>
            {saving && <Loader2 size={14} className="animate-spin text-green-400" />}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title="Compartilhar">
              <Share2 size={16} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left Side - Main Content */}
          <div className="flex-1 p-6 space-y-6 min-w-0">
            {/* Title */}
            {editingTitle ? (
              <input
                ref={titleInputRef}
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                className="w-full text-xl font-bold bg-transparent outline-none px-0 py-1 rounded"
                style={{ color: 'var(--text-primary)', borderBottom: '2px solid #25D066' }}
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="text-xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: 'var(--text-primary)' }}
              >
                {ticket.title}
              </h2>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <Plus size={12} />Adicionar
              </button>
              <div className="relative">
                <button onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/10"
                  style={{ background: priorityCfg.bg, color: priorityCfg.color, border: `1px solid ${priorityCfg.border}` }}>
                  <Tag size={12} />Prioridade: {priorityCfg.label}
                </button>
                {showPriorityMenu && (
                  <div className="absolute top-full left-0 mt-1 z-10 rounded-xl overflow-hidden py-1 min-w-[150px]"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
                    {(['high', 'medium', 'low'] as const).map(p => (
                      <button key={p} onClick={() => handlePriorityChange(p)}
                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-white/5"
                        style={{ color: PRIORITY_CONFIG[p].color }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: PRIORITY_CONFIG[p].color }} />
                        {PRIORITY_CONFIG[p].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <Calendar size={12} />Datas
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <Users size={12} />Membros
              </button>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlignLeft size={16} style={{ color: 'var(--text-muted)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Descrição</h3>
              </div>
              {editingDesc ? (
                <div>
                  <textarea
                    autoFocus
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    className="w-full dark-input rounded-lg px-4 py-3 text-sm resize-none"
                    placeholder="Adicione uma descrição mais detalhada..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleDescSave} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#25D066' }}>Salvar</button>
                    <button onClick={() => { setEditingDesc(false); setDescription(ticket.description || '') }} className="px-4 py-1.5 rounded-lg text-xs" style={{ color: 'var(--text-muted)' }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditingDesc(true)}
                  className="cursor-pointer rounded-lg px-4 py-3 text-sm min-h-[60px] transition-colors hover:bg-white/5"
                  style={{ background: 'rgba(255,255,255,0.03)', color: description ? 'var(--text-secondary)' : 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                >
                  {description || 'Adicione uma descrição mais detalhada...'}
                </div>
              )}
            </div>

            {/* Assignee */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} style={{ color: 'var(--text-muted)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Responsável</h3>
              </div>
              <input
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                onBlur={handleAssigneeSave}
                onKeyDown={e => e.key === 'Enter' && handleAssigneeSave()}
                placeholder="Atribuir responsável..."
                className="dark-input w-full rounded-lg px-4 py-2.5 text-sm"
              />
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Paperclip size={16} style={{ color: 'var(--text-muted)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Anexos</h3>
                  {attachments.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(37,208,102,0.12)', color: '#25D066' }}>
                      {attachments.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  {uploading ? 'Enviando...' : 'Adicionar'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />

              {attachments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attachments.map(att => (
                    <div key={att.id} className="group relative rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                      {att.file_type === 'image' ? (
                        <a href={att.file_url} target="_blank" rel="noreferrer">
                          <img src={att.file_url} alt={att.file_name} className="w-full h-28 object-cover" />
                        </a>
                      ) : att.file_type === 'video' ? (
                        <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-28 bg-black/30">
                          <Video size={28} className="text-slate-400" />
                        </a>
                      ) : (
                        <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-28">
                          <FileText size={28} className="text-slate-400" />
                        </a>
                      )}
                      <div className="px-2 py-1.5 flex items-center justify-between">
                        <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{att.file_name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={att.file_url} download={att.file_name} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-white/10">
                            <Download size={10} className="text-slate-400" />
                          </a>
                          <button onClick={() => handleDeleteAttachment(att)} className="p-1 rounded hover:bg-red-500/20">
                            <Trash2 size={10} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 rounded-xl text-xs" style={{ border: '2px dashed rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 hover:text-white transition-colors">
                    <Image size={16} />
                    Clique para adicionar fotos, vídeos ou arquivos
                  </button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setActiveTab('comments')}
                className={clsx('flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all', activeTab === 'comments' ? 'text-white' : '')}
                style={{ background: activeTab === 'comments' ? 'rgba(37,208,102,0.15)' : 'transparent', color: activeTab === 'comments' ? '#25D066' : 'var(--text-muted)' }}
              >
                <MessageSquare size={13} />Comentários
                {comments.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(37,208,102,0.2)' }}>{comments.length}</span>}
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={clsx('flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all')}
                style={{ background: activeTab === 'details' ? 'rgba(37,208,102,0.15)' : 'transparent', color: activeTab === 'details' ? '#25D066' : 'var(--text-muted)' }}
              >
                <AlignLeft size={13} />Detalhes
              </button>
            </div>

            {/* Comments Section */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                {/* Comment Input */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: '#25D066' }}>
                    {user.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea
                      ref={commentInputRef}
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Escrever um comentário..."
                      rows={2}
                      className="dark-input w-full rounded-lg px-4 py-2.5 text-sm resize-none"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
                    />
                    {newComment.trim() && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleSendComment}
                          disabled={sendingComment}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                          style={{ background: '#25D066' }}
                        >
                          {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Enviar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments List */}
                <AnimatePresence>
                  {comments.map(comment => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: comment.user_name === user ? '#25D066' : '#6366f1' }}>
                        {comment.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{comment.user_name.split('@')[0]}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(comment.created_at)}</span>
                        </div>
                        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                          {comment.content}
                        </div>
                        {comment.user_name === user && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="opacity-0 group-hover:opacity-100 mt-1 text-[10px] flex items-center gap-1 transition-opacity hover:text-red-400"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 size={10} />Excluir
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {comments.length === 0 && (
                  <div className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Nenhum comentário ainda. Seja o primeiro a comentar!
                  </div>
                )}
              </div>
            )}

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Criado em</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(ticket.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Atualizado</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(ticket.updated_at).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status</span>
                  <span style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Prioridade</span>
                  <span style={{ color: priorityCfg.color }}>{priorityCfg.label}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Responsável</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{ticket.assignee || 'Não atribuído'}</span>
                </div>
                {ticket.tags && ticket.tags.length > 0 && (
                  <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tags</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {ticket.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(37,208,102,0.08)', color: '#86efac', border: '1px solid rgba(37,208,102,0.15)' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Side - Actions */}
          <div className="lg:w-56 p-6 lg:pt-6 space-y-2 flex-shrink-0" style={{ borderLeft: '1px solid var(--border-subtle)' }}>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Ações</h4>

            <button onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/10 text-left"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
              <Paperclip size={14} />Anexar arquivo
            </button>

            <button onClick={handleShare}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/10 text-left"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
              <Share2 size={14} />Compartilhar
            </button>

            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/10 text-left"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
              <Tag size={14} />Etiquetas
            </button>

            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/10 text-left"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
              <Calendar size={14} />Datas
            </button>

            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/10 text-left"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
              <Users size={14} />Membros
            </button>

            <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={handleDeleteTicket}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-red-500/20 text-left text-red-400"
                style={{ background: 'rgba(239,68,68,0.06)' }}>
                <Trash2 size={14} />Excluir ticket
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
