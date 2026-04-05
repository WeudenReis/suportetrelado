import { supabase } from '../supabase'
import { logger } from '../logger'
import type { PlannerEvent, PlannerNotificationSettings } from '../supabase'

export async function fetchPlannerEvents(email: string): Promise<PlannerEvent[]> {
  const { data, error } = await supabase
    .from('planner_events')
    .select('*')
    .eq('user_email', email)
  if (error) { logger.warn('Planner', 'Tabela planner_events pode não existir', { error: error.message }); return [] }
  return (data ?? []) as PlannerEvent[]
}

export async function insertPlannerEvent(event: Omit<PlannerEvent, 'id' | 'created_at' | 'updated_at'>): Promise<PlannerEvent | null> {
  const { data, error } = await supabase
    .from('planner_events')
    .insert(event)
    .select()
    .single()
  if (error) { logger.error('Planner', 'Falha ao inserir evento', { error: error.message }); return null }
  return data as PlannerEvent
}

export async function updatePlannerEvent(id: string, updates: Partial<PlannerEvent>): Promise<void> {
  await supabase.from('planner_events').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deletePlannerEvent(id: string): Promise<void> {
  await supabase.from('planner_events').delete().eq('id', id)
}

export async function fetchPlannerSettings(email: string): Promise<PlannerNotificationSettings | null> {
  const { data, error } = await supabase
    .from('planner_notification_settings')
    .select('*')
    .eq('user_email', email)
    .maybeSingle()
  if (error) { logger.warn('Planner', 'Tabela planner_notification_settings pode não existir', { error: error.message }); return null }
  return data as PlannerNotificationSettings
}

export async function upsertPlannerSettings(settings: Omit<PlannerNotificationSettings, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  const { error } = await supabase
    .from('planner_notification_settings')
    .upsert({ ...settings, updated_at: new Date().toISOString() }, { onConflict: 'user_email' })
  if (error) logger.error('Planner', 'Falha ao salvar configurações', { error: error.message })
}
