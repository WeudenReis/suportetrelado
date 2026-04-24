import { supabase } from '../supabase'
import { logger } from '../logger'
import type { Announcement, AnnouncementAttachment, AnnouncementSeverity } from '../supabase'
import { refreshAttachmentUrls } from './announcementAttachments'

function normalize(row: Announcement): Announcement {
  return { ...row, attachments: Array.isArray(row.attachments) ? row.attachments : [] }
}

export async function fetchAnnouncements(departmentId?: string): Promise<Announcement[]> {
  let query = supabase.from('announcements').select('*').eq('is_active', true)
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { logger.warn('Announcements', 'Erro ao buscar avisos', { error: error.message }); return [] }

  const rows = (data ?? []).map(r => normalize(r as Announcement))

  // Renova signed URLs (TTL de 1h padrão) — mesmo padrão usado em fetchAttachments para tickets
  return Promise.all(rows.map(async ann => ({
    ...ann,
    attachments: await refreshAttachmentUrls(ann.attachments),
  })))
}

export async function insertAnnouncement(ann: {
  title: string
  content: string
  severity: AnnouncementSeverity
  author: string
  is_pinned?: boolean
  department_id: string
  attachments?: AnnouncementAttachment[]
}): Promise<Announcement | null> {
  const payload = { ...ann, attachments: ann.attachments ?? [] }
  const { data, error } = await supabase
    .from('announcements')
    .insert(payload)
    .select()
    .single()
  if (error) { logger.error('Announcements', 'Falha ao inserir aviso', { error: error.message }); return null }
  return normalize(data as Announcement)
}

export async function updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<void> {
  await supabase.from('announcements').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await supabase.from('announcements').delete().eq('id', id)
}
