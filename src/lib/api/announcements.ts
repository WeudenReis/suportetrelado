import { supabase } from '../supabase'
import { logger } from '../logger'
import type { Announcement, AnnouncementSeverity } from '../supabase'

export async function fetchAnnouncements(departmentId?: string): Promise<Announcement[]> {
  let query = supabase.from('announcements').select('*').eq('is_active', true)
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { logger.warn('Announcements', 'Erro ao buscar avisos', { error: error.message }); return [] }
  return (data ?? []) as Announcement[]
}

export async function insertAnnouncement(ann: { title: string; content: string; severity: AnnouncementSeverity; author: string; is_pinned?: boolean }): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .insert(ann)
    .select()
    .single()
  if (error) { logger.error('Announcements', 'Falha ao inserir aviso', { error: error.message }); return null }
  return data as Announcement
}

export async function updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<void> {
  await supabase.from('announcements').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await supabase.from('announcements').delete().eq('id', id)
}
