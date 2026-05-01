import { supabase } from '../supabase'
import { logger } from '../logger'
import type { ActivityLog } from '../supabase'

export async function fetchActivityLog(cardId: string): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true })
  if (error) { logger.warn('ActivityLog', 'Tabela activity_log pode não existir', { error: error.message }); return [] }
  return (data ?? []) as ActivityLog[]
}

export async function insertActivityLog(cardId: string, userName: string, actionText: string, departmentId?: string): Promise<ActivityLog | null> {
  const row: Record<string, unknown> = { card_id: cardId, user_name: userName, action_text: actionText }
  if (departmentId) row.department_id = departmentId
  const { data, error } = await supabase
    .from('activity_log')
    .insert(row)
    .select()
    .single()
  if (error) { logger.warn('ActivityLog', 'Falha ao inserir atividade', { error: error.message }); return null }
  return data as ActivityLog
}
