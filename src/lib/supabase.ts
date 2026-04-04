import { createClient } from '@supabase/supabase-js'

// Credenciais via variáveis de ambiente (.env / .env.production)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidas. Verifique seu .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const isDevEnvironment = !supabaseUrl.includes('qacrxpfoamarslxskcyb')

export type TicketStatus = string  // dinâmico: vem das board_columns agora
export type TicketPriority = 'low' | 'medium' | 'high'

/** Opções de paginação para queries que retornam listas */
export interface PaginationOptions {
  page?: number
  pageSize?: number
}

export interface Ticket {
  id: string
  department_id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignee?: string | null
  created_at: string
  updated_at: string
  tags?: string[] | null
  cliente?: string | null
  instancia?: string | null
  link_retaguarda?: string | null
  link_sessao?: string | null
  observacao?: string | null
  due_date?: string | null
  cover_image_url?: string | null
  cover_thumb_url?: string | null
  is_archived?: boolean
  is_completed?: boolean
  attachment_count?: number
}

export interface Comment {
  id: string
  department_id: string
  ticket_id: string
  user_name: string
  content: string
  created_at: string
}

export interface Attachment {
  id: string
  department_id: string
  ticket_id: string
  file_name: string
  file_url: string
  file_type: string
  uploaded_by: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  department_id: string
  card_id: string
  user_name: string
  action_text: string
  created_at: string
}

export type TicketInsert = {
  department_id: string
  title: string
  description?: string
  status?: TicketStatus
  priority?: TicketPriority
  assignee?: string | null
  tags?: string[] | null
  cliente?: string | null
  instancia?: string | null
  link_retaguarda?: string | null
  link_sessao?: string | null
  observacao?: string | null
}

// ── Board Labels (etiquetas reutilizáveis) ──
export interface BoardLabel {
  id: string
  department_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export async function fetchBoardLabels(departmentId?: string): Promise<BoardLabel[]> {
  let query = supabase.from('board_labels').select('*')
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as BoardLabel[]
}

export async function insertBoardLabel(name: string, color: string, departmentId?: string): Promise<BoardLabel> {
  const row: Record<string, unknown> = { name, color }
  if (departmentId) row.department_id = departmentId
  const { data, error } = await supabase
    .from('board_labels')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as BoardLabel
}

export async function updateBoardLabel(id: string, updates: { name?: string; color?: string }): Promise<void> {
  const { error } = await supabase
    .from('board_labels')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteBoardLabel(id: string): Promise<void> {
  const { error } = await supabase
    .from('board_labels')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function fetchTickets(opts?: { departmentId?: string } & PaginationOptions): Promise<Ticket[]> {
  let query = supabase.from('tickets').select('*').eq('is_archived', false)
  if (opts?.departmentId) query = query.eq('department_id', opts.departmentId)
  query = query.order('created_at', { ascending: false })
  if (opts?.page && opts?.pageSize) {
    const from = (opts.page - 1) * opts.pageSize
    query = query.range(from, from + opts.pageSize - 1)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Ticket[]
}

export async function insertTicket(ticket: TicketInsert): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .insert(ticket)
    .select()
    .single()
  if (error) {
    console.error('insertTicket error:', error)
    if (error.message?.includes('schema cache')) {
      throw new Error('Coluna não encontrada no banco. Execute a migration v7 no Supabase SQL Editor.')
    }
    throw error
  }
  return data as Ticket
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('updateTicket error:', error)
    if (error.message?.includes('schema cache')) {
      throw new Error('Coluna não encontrada no banco. Execute a migration v7 no Supabase SQL Editor.')
    }
    throw error
  }
  return data as Ticket
}

export async function deleteTicket(id: string): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// --- Comments ---
export async function fetchComments(ticketId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) { console.warn('comments table may not exist:', error.message); return [] }
  return (data ?? []) as Comment[]
}

export async function insertComment(ticketId: string, userName: string, content: string, departmentId?: string): Promise<Comment | null> {
  const row: Record<string, unknown> = { ticket_id: ticketId, user_name: userName, content }
  if (departmentId) row.department_id = departmentId
  const { data, error } = await supabase
    .from('comments')
    .insert(row)
    .select()
    .single()
  if (error) { console.error('Failed to insert comment:', error.message); return null }
  return data as Comment
}

export async function deleteComment(id: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', id)
}

// --- Attachments ---
export async function fetchAttachmentCounts(departmentId?: string): Promise<Record<string, number>> {
  let query = supabase.from('attachments').select('ticket_id')
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query
  if (error) { console.warn('attachments count error:', error.message); return {} }
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.ticket_id] = (counts[row.ticket_id] || 0) + 1
  }
  return counts
}

export async function fetchAttachments(ticketId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) { console.warn('attachments table may not exist:', error.message); return [] }
  return (data ?? []) as Attachment[]
}

export async function uploadAttachment(ticketId: string, file: File, userName: string, departmentId?: string): Promise<Attachment | null> {
  const fileExt = file.name.split('.').pop()
  const filePath = `${ticketId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(filePath, file)
  if (uploadError) { console.error('Upload failed:', uploadError.message); return null }

  // Usar URL assinada (expira em 1h) em vez de URL pública
  const { data: signedData, error: signError } = await supabase.storage
    .from('attachments')
    .createSignedUrl(filePath, 3600)

  const fileUrl = signedData?.signedUrl
  if (signError || !fileUrl) {
    // Fallback: tentar URL pública (caso storage policies antigas)
    const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath)
    console.warn('[Attachments] Signed URL falhou, usando public URL:', signError?.message)
    const fallbackUrl = publicUrl
    const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file'
    const row: Record<string, unknown> = { ticket_id: ticketId, file_name: file.name, file_url: fallbackUrl, file_type: fileType, uploaded_by: userName, storage_path: filePath }
    if (departmentId) row.department_id = departmentId
    const { data, error } = await supabase.from('attachments').insert(row).select().single()
    if (error) { console.error('Failed to save attachment:', error.message); return null }
    return data as Attachment
  }

  const fileType = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('video/') ? 'video' : 'file'

  const row: Record<string, unknown> = { ticket_id: ticketId, file_name: file.name, file_url: fileUrl, file_type: fileType, uploaded_by: userName, storage_path: filePath }
  if (departmentId) row.department_id = departmentId
  const { data, error } = await supabase
    .from('attachments')
    .insert(row)
    .select()
    .single()
  if (error) { console.error('Failed to save attachment:', error.message); return null }
  return data as Attachment
}

/** Gera URL assinada para um attachment existente (renovação) */
export async function getSignedAttachmentUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, expiresIn)
  if (error) { console.warn('[Attachments] Signed URL error:', error.message); return null }
  return data.signedUrl
}

export async function deleteAttachment(id: string, fileUrl: string): Promise<void> {
  // Extract path from URL for storage deletion
  try {
    const url = new URL(fileUrl)
    const pathParts = url.pathname.split('/storage/v1/object/public/attachments/')
    if (pathParts[1]) {
      await supabase.storage.from('attachments').remove([decodeURIComponent(pathParts[1])])
    }
  } catch { /* ignore path extraction errors */ }
  await supabase.from('attachments').delete().eq('id', id)
}

// --- Activity Log ---
export async function fetchActivityLog(cardId: string): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true })
  if (error) { console.warn('activity_log table may not exist:', error.message); return [] }
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
  if (error) { console.warn('Failed to insert activity:', error.message); return null }
  return data as ActivityLog
}

// --- User Profiles ---
export interface UserProfile {
  id: string
  organization_id: string
  email: string
  name: string
  avatar_color: string
  role: string
  last_seen_at: string
  created_at: string
}

export async function checkAuthorizedUser(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (error) { console.warn('checkAuthorizedUser:', error.message); return false }
  return !!data
}

const AVATAR_COLORS = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']

export async function upsertUserProfile(email: string): Promise<void> {
  // Tenta pegar o nome real do Google
  const { data: { session } } = await supabase.auth.getSession()
  const fullName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || ''
  const firstName = fullName ? fullName.split(' ')[0] : (email.includes('@') ? email.split('@')[0] : email)
  const name = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      { email, name, avatar_color: color, last_seen_at: new Date().toISOString() },
      { onConflict: 'email' }
    )
  if (error) console.warn('upsertUserProfile:', error.message)
}

export async function updateLastSeen(email: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('email', email)
  if (error) console.warn('updateLastSeen:', error.message)
}

export async function fetchUserProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('last_seen_at', { ascending: false })
  if (error) { console.warn('user_profiles table may not exist:', error.message); return [] }
  return (data ?? []) as UserProfile[]
}

// --- Notifications ---
export interface Notification {
  id: string
  department_id: string
  recipient_email: string
  sender_name: string
  type: 'mention' | 'assignment' | 'move' | 'comment' | 'announcement' | 'due_date_alert' | 'planner_event'
  ticket_id: string | null
  ticket_title: string
  message: string
  is_read: boolean
  created_at: string
}

export async function fetchNotifications(email: string, opts?: PaginationOptions): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_email', email)
    .order('created_at', { ascending: false })

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 50
  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, error } = await query
  if (error) { console.warn('notifications table may not exist:', error.message); return [] }
  return (data ?? []) as Notification[]
}

export async function insertNotification(notif: Omit<Notification, 'id' | 'is_read' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('notifications').insert(notif as Record<string, unknown>)
  if (error) console.warn('insertNotification:', error.message)
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markAllNotificationsRead(email: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('recipient_email', email).eq('is_read', false)
}

export function extractMentionNames(text: string): string[] {
  const regex = /@([\w\u00C0-\u024F]+)/g
  const names: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    names.push(match[1].toLowerCase())
  }
  return [...new Set(names)]
}

export async function resolveMentionsToEmails(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const profiles = await fetchUserProfiles()
  const emails: string[] = []
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  for (const name of names) {
    const n = normalize(name)
    const match = profiles.find(p =>
      normalize(p.name) === n ||
      normalize(p.email.split('@')[0]) === n
    )
    if (match) emails.push(match.email)
  }
  return emails
}

// ── Announcements (Avisos do Supervisor) ──
export type AnnouncementSeverity = 'info' | 'warning' | 'critical'

export interface Announcement {
  id: string
  department_id: string
  title: string
  content: string
  severity: AnnouncementSeverity
  author: string
  is_pinned: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function fetchAnnouncements(departmentId?: string): Promise<Announcement[]> {
  let query = supabase.from('announcements').select('*').eq('is_active', true)
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { console.warn('announcements error:', error.message); return [] }
  return (data ?? []) as Announcement[]
}

export async function insertAnnouncement(ann: { title: string; content: string; severity: AnnouncementSeverity; author: string; is_pinned?: boolean }): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .insert(ann)
    .select()
    .single()
  if (error) { console.error('insert announcement error:', error.message); return null }
  return data as Announcement
}

export async function updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<void> {
  await supabase.from('announcements').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await supabase.from('announcements').delete().eq('id', id)
}

// ── Useful Links (Links Úteis) ──
export interface UsefulLink {
  id: string
  department_id: string
  title: string
  url: string
  description: string
  category: string
  icon: string
  added_by: string
  created_at: string
  updated_at: string
}

export async function fetchUsefulLinks(departmentId?: string): Promise<UsefulLink[]> {
  let query = supabase.from('useful_links').select('*')
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query
    .order('category', { ascending: true })
    .order('title', { ascending: true })
  if (error) { console.warn('useful_links error:', error.message); return [] }
  return (data ?? []) as UsefulLink[]
}

export async function insertUsefulLink(link: { title: string; url: string; description?: string; category: string; added_by: string }): Promise<UsefulLink | null> {
  const { data, error } = await supabase
    .from('useful_links')
    .insert(link)
    .select()
    .single()
  if (error) { console.error('insert link error:', error.message); return null }
  return data as UsefulLink
}

export async function updateUsefulLink(id: string, updates: Partial<UsefulLink>): Promise<void> {
  await supabase.from('useful_links').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteUsefulLink(id: string): Promise<void> {
  const { error } = await supabase.from('useful_links').delete().eq('id', id)
  if (error) console.error('[Links] Falha ao deletar link:', error.message)
}
  
// ── Planner Events & Settings ──
export interface PlannerEvent {
  id: string
  organization_id: string
  user_email: string
  title: string
  description: string
  date: string
  start_time: string | null
  end_time: string | null
  color: string
  created_at: string
  updated_at: string
}

export interface PlannerNotificationSettings {
  id: string
  user_email: string
  notify_days_before: number[]
  created_at: string
  updated_at: string
}

export async function fetchPlannerEvents(email: string): Promise<PlannerEvent[]> {
  const { data, error } = await supabase
    .from('planner_events')
    .select('*')
    .eq('user_email', email)
  if (error) { console.warn('planner_events table may not exist:', error.message); return [] }
  return (data ?? []) as PlannerEvent[]
}

export async function insertPlannerEvent(event: Omit<PlannerEvent, 'id' | 'created_at' | 'updated_at'>): Promise<PlannerEvent | null> {
  const { data, error } = await supabase
    .from('planner_events')
    .insert(event)
    .select()
    .single()
  if (error) { console.error('insert planner event error:', error.message); return null }
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
  if (error) { console.warn('planner_notification_settings table may not exist:', error.message); return null }
  return data as PlannerNotificationSettings
}

export async function upsertPlannerSettings(settings: Omit<PlannerNotificationSettings, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  const { error } = await supabase
    .from('planner_notification_settings')
    .upsert({ ...settings, updated_at: new Date().toISOString() }, { onConflict: 'user_email' })
  if (error) console.error('upsert planner settings error:', error.message)
}

