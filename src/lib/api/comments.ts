import { supabase } from '../supabase'
import { logger } from '../logger'
import type { Comment } from '../supabase'
import { CommentInsertSchema } from '../schemas'
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
