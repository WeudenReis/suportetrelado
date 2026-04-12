import React, { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, Loader2, Trash2, ArrowRight, Lock } from 'lucide-react'
import {
  supabase, fetchComments, insertComment, deleteComment,
  fetchActivityLog, insertNotification, extractMentionNames, resolveMentionsToEmails
} from '../../lib/supabase'
import { logger } from '../../lib/logger'
import type { Comment, ActivityLog, UserProfile } from '../../lib/supabase'

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
export function avatarColor(name: string) {
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

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(name || 'U') }}
    >
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  )
}

interface CardCommentsProps {
  ticketId: string
  ticketTitle: string
  ticketDepartmentId: string | null
  user: string
  allUsers: UserProfile[]
}

export default function CardComments({ ticketId, ticketTitle, ticketDepartmentId, user, allUsers }: CardCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [commentFocused, setCommentFocused] = useState(false)
  const [isInternalNote, setIsInternalNote] = useState(false)

  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [showActivities, setShowActivities] = useState(false)
  const [showComments, setShowComments] = useState(false)

  const commentRef = useRef<HTMLTextAreaElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const mentionStartPos = useRef<number>(0)

  useEffect(() => {
    fetchComments(ticketId).then(setComments)
    fetchActivityLog(ticketId).then(setActivities)
  }, [ticketId])

  useEffect(() => {
    const ch = supabase
      .channel(`modal-comments-${ticketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticketId}` }, p => {
        setComments(prev => prev.some(c => c.id === (p.new as Comment).id) ? prev : [...prev, p.new as Comment])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticketId}` }, p => {
        setComments(prev => prev.filter(c => c.id !== (p.old as Record<string, string>).id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `card_id=eq.${ticketId}` }, p => {
        setActivities(prev => prev.some(a => a.id === (p.new as ActivityLog).id) ? prev : [...prev, p.new as ActivityLog])
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [ticketId])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length, activities.length])

  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filteredMentionUsers = mentionQuery !== null
    ? allUsers.filter(u => {
        const q = normalize(mentionQuery)
        if (u.email.toLowerCase() === user.toLowerCase()) return false
        if (!q) return true
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
      const c = await insertComment(ticketId, user, commentText, ticketDepartmentId ?? undefined)
      if (c) setComments(prev => [...prev, c])
      setNewComment('')
      setIsInternalNote(false)
      setSendingComment(false)
      commentRef.current?.focus()

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
              department_id: ticketDepartmentId || '',
              recipient_email: email,
              sender_name: senderDisplayName,
              type: 'mention',
              ticket_id: ticketId,
              ticket_title: ticketTitle,
              message: `mencionou voce: "${commentText.length > 80 ? commentText.slice(0, 80) + '...' : commentText}"`,
            })
          }
        }
      }
    } catch (err) {
      logger.error('CardComments', 'Falha ao enviar comentario', { error: String(err) })
      setSendingComment(false)
    }
  }

  const handleDeleteComment = async (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id))
    await deleteComment(id)
  }

  const feedItems = useMemo(() => [
    ...comments.map(c => ({ type: 'comment' as const, id: c.id, user: c.user_name, text: c.content, time: c.created_at })),
    ...(showActivities ? activities.map(a => ({ type: 'activity' as const, id: a.id, user: a.user_name, text: a.action_text, time: a.created_at })) : []),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()), [comments, activities, showActivities])

  return (
    <>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#b6c2cf' }}>
          <MessageSquare size={14} style={{ color: '#596773' }} />
          Timeline
          {comments.length > 0 && <span className="text-[10px] font-normal" style={{ color: '#596773' }}>({comments.length})</span>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowComments(!showComments)} className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
            style={{ background: showComments ? 'rgba(87,157,255,0.12)' : 'rgba(255,255,255,0.06)', color: showComments ? '#579dff' : '#b6c2cf' }}>
            {showComments ? 'Ocultar' : 'Mostrar'} comentarios
          </button>
          <button onClick={() => setShowActivities(!showActivities)} className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
            style={{ background: showActivities ? 'rgba(87,157,255,0.12)' : 'rgba(255,255,255,0.06)', color: showActivities ? '#579dff' : '#b6c2cf' }}>
            {showActivities ? 'Ocultar' : 'Mostrar'} atividade
          </button>
        </div>
      </div>

      {showComments && <div className="flex gap-2 mb-3 flex-shrink-0">
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
            placeholder="Escrever um comentario... Use @ para mencionar"
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
      </div>}

      {showComments && (
        <div className="elite-modal__feed">
          {feedItems.map(item => (
            <div key={item.id} className="flex gap-2 group">
              <Avatar name={item.user} size={24} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold" style={{ color: '#b6c2cf' }}>
                    {item.user.includes('@') ? item.user.split('@')[0] : item.user}
                  </span>
                  <span className="text-[10px]" style={{ color: '#596773' }}>{timeAgo(item.time)}</span>
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
          ))}
          {feedItems.length === 0 && (
            <div className="text-center py-6 text-[12px]" style={{ color: '#596773' }}>Nenhuma atividade ainda.</div>
          )}
          <div ref={commentsEndRef} />
        </div>
      )}

      {!showComments && comments.length > 0 && (
        <div className="flex-1 flex items-center justify-center">
          <button onClick={() => setShowComments(true)} className="text-[11px] px-3 py-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#596773', border: '1px dashed rgba(166,197,226,0.12)' }}>
            <MessageSquare size={14} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
            {comments.length} comentario{comments.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </>
  )
}
