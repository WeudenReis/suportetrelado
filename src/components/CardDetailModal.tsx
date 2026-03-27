import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, AlignLeft, MessageSquare, Paperclip, Tag, Calendar, Users, CheckSquare,
  Clock, Share2, Trash2, Send, Loader2, Download, Plus, Video, FileText,
  ChevronDown, ArrowRight, Image as ImageIcon
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
  const [editingDesc, setEditingDesc] = useState(false)
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [assignee, setAssignee] = useState(ticket.assignee || '')
  const [saving, setSaving] = useState(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [commentFocused, setCommentFocused] = useState(false)

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)

  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [showDetails, setShowDetails] = useState(true)

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

  // --- Handlers ---
  const handleTitleBlur = () => {
    if (title.trim() && title !== ticket.title) save({ title: title.trim() })
  }

  const handleDescSave = () => {
    setEditingDesc(false)
    if (description !== (ticket.description || '')) save({ description })
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    const oldLabel = STATUS_MAP[status]
    const newLabel = STATUS_MAP[newStatus]
    setStatus(newStatus)
    setShowStatusDropdown(false)
    await save({ status: newStatus })
    await insertActivityLog(ticket.id, user, `moveu este cartão de ${oldLabel} para ${newLabel}`)
    fetchActivityLog(ticket.id).then(setActivities)
  }

  const handleAssigneeBlur = () => {
    if (assignee !== (ticket.assignee || '')) save({ assignee: assignee || null })
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
    ...activities.map(a => ({ type: 'activity' as const, id: a.id, user: a.user_name, text: a.action_text, time: a.created_at })),
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
        className="w-full max-w-[768px] my-12 mx-4 rounded-xl overflow-hidden shadow-2xl"
        style={{ background: '#1e1f23', color: '#c8cad0' }}
      >
        {/* ===== HEADER ===== */}
        <div className="relative px-6 pt-5 pb-3">
          {/* Close X */}
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: '#9fadbc' }}>
            <X size={20} />
          </button>

          {/* Title */}
          <div className="flex items-start gap-3 pr-10">
            <div className="mt-1 flex-shrink-0" style={{ color: '#9fadbc' }}><AlignLeft size={20} /></div>
            <div className="flex-1 min-w-0">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={e => e.key === 'Enter' && (e.currentTarget.blur())}
                className="w-full text-xl font-semibold bg-transparent border-none outline-none focus:bg-white/5 rounded px-1 -ml-1 transition-colors"
                style={{ color: '#c8cad0' }}
              />
              {/* In list indicator */}
              <div className="flex items-center gap-1.5 mt-1 text-sm" style={{ color: '#9fadbc' }}>
                <span>na lista</span>
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 font-medium underline underline-offset-2 transition-colors"
                    style={{ color: STATUS_COLORS[status] }}
                  >
                    {STATUS_MAP[status]}
                    <ChevronDown size={14} />
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-20 rounded-lg overflow-hidden py-1 min-w-[200px] shadow-xl"
                      style={{ background: '#282a2e', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {(Object.entries(STATUS_MAP) as [TicketStatus, string][]).map(([key, label]) => (
                        <button key={key} onClick={() => handleStatusChange(key)}
                          className={clsx('w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors hover:bg-white/8', status === key && 'bg-white/5')}
                          style={{ color: status === key ? STATUS_COLORS[key] : '#c8cad0' }}>
                          <span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS[key] }} />
                          {label}
                          {status === key && <span className="ml-auto text-xs opacity-50">atual</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {saving && <Loader2 size={14} className="animate-spin ml-1" style={{ color: '#25D066' }} />}
              </div>
            </div>
          </div>
        </div>

        {/* ===== BODY: Two columns ===== */}
        <div className="flex flex-col lg:flex-row">
          {/* --- LEFT: Main content --- */}
          <div className="flex-1 px-6 pb-6 min-w-0">

            {/* Quick action buttons row */}
            <div className="flex flex-wrap gap-2 mb-6 mt-2">
              <SidebarBtn icon={<Plus size={14} />} label="Adicionar" onClick={() => fileInputRef.current?.click()} />
              <SidebarBtn icon={<Tag size={14} />} label="Etiquetas" />
              <SidebarBtn icon={<Calendar size={14} />} label="Datas" />
              <SidebarBtn icon={<CheckSquare size={14} />} label="Checklist" />
              <SidebarBtn icon={<Users size={14} />} label="Membros" />
            </div>

            {/* ---- Description ---- */}
            <SectionHeader icon={<AlignLeft size={18} />} title="Descrição" />
            {editingDesc ? (
              <div className="ml-[30px] mt-2">
                <textarea
                  autoFocus
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg px-4 py-3 text-sm resize-y outline-none"
                  style={{ background: '#22252a', color: '#c8cad0', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="Adicione uma descrição mais detalhada..."
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleDescSave} className="px-5 py-2 rounded-md text-sm font-semibold text-white" style={{ background: '#25D066' }}>Salvar</button>
                  <button onClick={() => { setEditingDesc(false); setDescription(ticket.description || '') }} className="px-4 py-2 rounded-md text-sm hover:bg-white/10 transition-colors" style={{ color: '#9fadbc' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingDesc(true)}
                className="ml-[30px] mt-2 cursor-pointer rounded-lg px-4 py-3 text-sm min-h-[72px] transition-colors hover:bg-white/5"
                style={{ background: '#22252a', color: description ? '#c8cad0' : '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {description || 'Adicione uma descrição mais detalhada...'}
              </div>
            )}

            {/* ---- Attachments ---- */}
            {(attachments.length > 0 || uploading) && (
              <>
                <SectionHeader icon={<Paperclip size={18} />} title="Anexos" className="mt-6" />
                <div className="ml-[30px] mt-2 grid grid-cols-3 gap-2">
                  {attachments.map(att => (
                    <div key={att.id} className="group relative rounded-lg overflow-hidden" style={{ background: '#22252a', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {att.file_type === 'image' ? (
                        <a href={att.file_url} target="_blank" rel="noreferrer"><img src={att.file_url} alt={att.file_name} className="w-full h-24 object-cover" /></a>
                      ) : att.file_type === 'video' ? (
                        <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-24"><Video size={24} style={{ color: '#6b7280' }} /></a>
                      ) : (
                        <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-24"><FileText size={24} style={{ color: '#6b7280' }} /></a>
                      )}
                      <div className="px-2 py-1.5 flex items-center justify-between">
                        <span className="text-[10px] truncate" style={{ color: '#9fadbc' }}>{att.file_name}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={att.file_url} download target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-white/10"><Download size={10} style={{ color: '#9fadbc' }} /></a>
                          <button onClick={() => handleDeleteAttachment(att)} className="p-1 rounded hover:bg-red-500/20"><Trash2 size={10} className="text-red-400" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {uploading && (
                    <div className="flex items-center justify-center h-24 rounded-lg" style={{ background: '#22252a', border: '2px dashed rgba(255,255,255,0.08)' }}>
                      <Loader2 size={20} className="animate-spin" style={{ color: '#25D066' }} />
                    </div>
                  )}
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />

            {/* ---- Responsável ---- */}
            <SectionHeader icon={<Users size={18} />} title="Responsável" className="mt-6" />
            <div className="ml-[30px] mt-2">
              <input
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                onBlur={handleAssigneeBlur}
                onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                placeholder="Atribuir responsável..."
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors focus:ring-1 focus:ring-green-500/30"
                style={{ background: '#22252a', color: '#c8cad0', border: '1px solid rgba(255,255,255,0.06)' }}
              />
            </div>

            {/* ---- Comentários e atividade ---- */}
            <div className="flex items-center justify-between mt-8 mb-2">
              <SectionHeader icon={<MessageSquare size={18} />} title="Comentários e atividade" />
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs px-3 py-1 rounded-md hover:bg-white/10 transition-colors"
                style={{ color: '#9fadbc' }}
              >
                {showDetails ? 'Mostrar Detalhes' : 'Ocultar Detalhes'}
              </button>
            </div>

            {/* Comment input */}
            <div className="ml-[30px] flex gap-3 mb-4">
              <Avatar name={user} size={32} />
              <div className="flex-1">
                <textarea
                  ref={commentRef}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onFocus={() => setCommentFocused(true)}
                  onBlur={() => !newComment.trim() && setCommentFocused(false)}
                  placeholder="Escrever um comentário..."
                  rows={commentFocused ? 3 : 1}
                  className="w-full rounded-lg px-4 py-2.5 text-sm outline-none resize-none transition-all"
                  style={{ background: '#22252a', color: '#c8cad0', border: commentFocused ? '1px solid rgba(37,208,102,0.3)' : '1px solid rgba(255,255,255,0.06)' }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
                />
                <AnimatePresence>
                  {(commentFocused || newComment.trim()) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex justify-end mt-2">
                      <button onClick={handleSendComment} disabled={!newComment.trim() || sendingComment}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold text-white disabled:opacity-40"
                        style={{ background: '#25D066' }}>
                        {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Salvar
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Feed: Comments + Activity merged */}
            <div className="ml-[30px] space-y-4 mb-4">
              <AnimatePresence>
                {feedItems.map(item => (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3 group">
                    <Avatar name={item.user} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: '#c8cad0' }}>
                          {item.user.includes('@') ? item.user.split('@')[0] : item.user}
                        </span>
                        <span className="text-[11px]" style={{ color: '#6b7280' }}>{timeAgo(item.time)}</span>
                      </div>

                      {item.type === 'comment' ? (
                        <>
                          <div className="mt-1 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed" style={{ background: '#282a2e', color: '#c8cad0', border: '1px solid rgba(255,255,255,0.04)' }}>
                            {item.text}
                          </div>
                          {item.user === user && (
                            <button onClick={() => handleDeleteComment(item.id)}
                              className="mt-1 text-[11px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                              style={{ color: '#6b7280' }}>
                              <Trash2 size={10} /> Excluir
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="mt-0.5 text-sm flex items-center gap-1.5" style={{ color: '#9fadbc' }}>
                          <ArrowRight size={12} style={{ color: '#25D066' }} />
                          {item.text}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {feedItems.length === 0 && (
                <div className="text-center py-8 text-sm" style={{ color: '#6b7280' }}>
                  Nenhuma atividade ainda.
                </div>
              )}
              <div ref={commentsEndRef} />
            </div>
          </div>

          {/* --- RIGHT: Sidebar --- */}
          <div className="lg:w-[192px] flex-shrink-0 px-4 pb-6 lg:pr-4 lg:pl-0">
            <div className="lg:sticky lg:top-0 space-y-1">
              <SidebarLabel>Adicionar ao cartão</SidebarLabel>
              <SidebarBtn icon={<Users size={14} />} label="Membros" />
              <SidebarBtn icon={<Tag size={14} />} label="Etiquetas" />
              <SidebarBtn icon={<CheckSquare size={14} />} label="Checklist" />
              <SidebarBtn icon={<Calendar size={14} />} label="Datas" />
              <SidebarBtn icon={<Paperclip size={14} />} label="Anexo" onClick={() => fileInputRef.current?.click()} />

              <div className="pt-3" />
              <SidebarLabel>Ações</SidebarLabel>
              <SidebarBtn icon={<Share2 size={14} />} label="Compartilhar" onClick={handleShare} />
              <SidebarBtn icon={<Trash2 size={14} />} label="Excluir" onClick={handleDelete} danger />
            </div>
          </div>
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

function SectionHeader({ icon, title, className = '' }: { icon: React.ReactNode; title: string; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <span style={{ color: '#9fadbc' }}>{icon}</span>
      <h3 className="text-base font-semibold" style={{ color: '#c8cad0' }}>{title}</h3>
    </div>
  )
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider pb-1" style={{ color: '#6b7280' }}>{children}</p>
}

function SidebarBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
        danger ? 'hover:bg-red-500/15 text-red-400' : 'hover:bg-white/10'
      )}
      style={danger ? {} : { color: '#c8cad0', background: 'rgba(255,255,255,0.04)' }}
    >
      {icon}
      {label}
    </button>
  )
}
