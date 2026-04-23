import { supabase } from '../supabase'
import { logger } from '../logger'
import type { Comment, CommentReaction } from '../supabase'
import { CommentInsertSchema, CommentReactionUpsertSchema } from '../schemas'
import { withOfflineFallback } from '../offlineQueue'

export async function fetchComments(ticketId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) { logger.warn('Comments', 'Tabela comments pode não existir', { error: error.message }); return [] }
  return (data ?? []) as Comment[]
}

export async function insertComment(ticketId: string, userName: string, content: string, departmentId?: string): Promise<Comment | null> {
  const parsed = CommentInsertSchema.safeParse({ ticket_id: ticketId, user_name: userName, content, department_id: departmentId ?? null })
  if (!parsed.success) {
    logger.warn('Comments', 'Payload inválido', { issues: parsed.error.issues })
    return null
  }
  const row: Record<string, unknown> = { ticket_id: parsed.data.ticket_id, user_name: parsed.data.user_name, content: parsed.data.content }
  if (parsed.data.department_id) row.department_id = parsed.data.department_id
  return await withOfflineFallback(
    'insertComment',
    { ticketId, userName, content, departmentId },
    async () => {
      const { data, error } = await supabase
        .from('comments')
        .insert(row)
        .select()
        .single()
      if (error) { logger.error('Comments', 'Falha ao inserir comentário', { error: error.message }); return null }
      return data as Comment
    },
  )
}


export async function deleteComment(id: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', id)
}

export async function fetchCommentReactions(commentIds: string[]): Promise<CommentReaction[]> {
  if (commentIds.length === 0) return []
  const { data, error } = await supabase
    .from('comment_reactions')
    .select('*')
    .in('comment_id', commentIds)
  if (error) {
    logger.warn('Comments', 'Falha ao buscar reações de comentários', { error: error.message })
    return []
  }
  return (data ?? []) as CommentReaction[]
}

export async function toggleCommentReaction(input: {
  commentId: string
  departmentId: string
  userEmail: string
  emoji: string
}): Promise<void> {
  const parsed = CommentReactionUpsertSchema.safeParse({
    comment_id: input.commentId,
    department_id: input.departmentId,
    user_email: input.userEmail,
    emoji: input.emoji,
  })

  if (!parsed.success) {
    logger.warn('Comments', 'Payload inválido para reação', { issues: parsed.error.issues })
    return
  }

  const { data: existing, error: existingError } = await supabase
    .from('comment_reactions')
    .select('id, emoji')
    .eq('comment_id', parsed.data.comment_id)
    .eq('user_email', parsed.data.user_email)
    .maybeSingle()

  if (existingError) {
    logger.warn('Comments', 'Falha ao verificar reação existente', { error: existingError.message })
    return
  }

  if (existing && existing.emoji === parsed.data.emoji) {
    const { error } = await supabase
      .from('comment_reactions')
      .delete()
      .eq('id', existing.id)
    if (error) logger.warn('Comments', 'Falha ao remover reação', { error: error.message })
    return
  }

  if (existing) {
    const { error } = await supabase
      .from('comment_reactions')
      .update({ emoji: parsed.data.emoji })
      .eq('id', existing.id)
    if (error) logger.warn('Comments', 'Falha ao atualizar reação', { error: error.message })
    return
  }

  const { error } = await supabase.from('comment_reactions').insert({
    comment_id: parsed.data.comment_id,
    department_id: parsed.data.department_id,
    user_email: parsed.data.user_email,
    emoji: parsed.data.emoji,
  })
  if (error) logger.warn('Comments', 'Falha ao inserir reação', { error: error.message })
}
