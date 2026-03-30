import { createClient } from '@supabase/supabase-js'

// URLs e chaves fixas — VITE_SUPABASE_URL no Vercel determina o ambiente
// Production: VITE_SUPABASE_URL = PROD_URL → usa prod
// Preview/Dev: VITE_SUPABASE_URL ausente ou diferente → usa dev
const PROD_URL = 'https://qacrxpfoamarslxskcyb.supabase.co'
const PROD_KEY = 'sb_publishable_Qc_kigRTle0uzM6LAsLHbQ_XuBHWJV3'
const DEV_URL = 'https://vbxzeyweurzrwppdiluo.supabase.co'
const DEV_KEY = 'sb_publishable_03VCMlD83Jf9fsXJB97Ccw_QEYH_4Ps'

const envUrl = String((import.meta as any).env?.VITE_SUPABASE_URL || '')
const isProd = envUrl === PROD_URL

const supabaseUrl = isProd ? PROD_URL : DEV_URL
const supabaseAnonKey = isProd ? PROD_KEY : DEV_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const isDevEnvironment = !isProd

export type TicketStatus = 'backlog' | 'in_progress' | 'waiting_devs' | 'resolved'
export type TicketPriority = 'low' | 'medium' | 'high'

export interface Ticket {
  id: string
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
}

export interface Comment {
  id: string
  ticket_id: string
  user_name: string
  content: string
  created_at: string
}

export interface Attachment {
  id: string
  ticket_id: string
  file_name: string
  file_url: string
  file_type: string
  uploaded_by: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  card_id: string
  user_name: string
  action_text: string
  created_at: string
}

export type TicketInsert = {
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

export async function fetchTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
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

export async function insertComment(ticketId: string, userName: string, content: string): Promise<Comment | null> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ ticket_id: ticketId, user_name: userName, content })
    .select()
    .single()
  if (error) { console.error('Failed to insert comment:', error.message); return null }
  return data as Comment
}

export async function deleteComment(id: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', id)
}

// --- Attachments ---
export async function fetchAttachments(ticketId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) { console.warn('attachments table may not exist:', error.message); return [] }
  return (data ?? []) as Attachment[]
}

export async function uploadAttachment(ticketId: string, file: File, userName: string): Promise<Attachment | null> {
  const fileExt = file.name.split('.').pop()
  const filePath = `${ticketId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(filePath, file)
  if (uploadError) { console.error('Upload failed:', uploadError.message); return null }

  const { data: { publicUrl } } = supabase.storage
    .from('attachments')
    .getPublicUrl(filePath)

  const fileType = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('video/') ? 'video' : 'file'

  const { data, error } = await supabase
    .from('attachments')
    .insert({ ticket_id: ticketId, file_name: file.name, file_url: publicUrl, file_type: fileType, uploaded_by: userName })
    .select()
    .single()
  if (error) { console.error('Failed to save attachment:', error.message); return null }
  return data as Attachment
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

export async function insertActivityLog(cardId: string, userName: string, actionText: string): Promise<ActivityLog | null> {
  const { data, error } = await supabase
    .from('activity_log')
    .insert({ card_id: cardId, user_name: userName, action_text: actionText })
    .select()
    .single()
  if (error) { console.warn('Failed to insert activity:', error.message); return null }
  return data as ActivityLog
}

// --- User Profiles ---
export interface UserProfile {
  id: string
  email: string
  name: string
  avatar_color: string
  role: string
  last_seen_at: string
  created_at: string
}

const AVATAR_COLORS = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']

export async function upsertUserProfile(email: string): Promise<void> {
  const name = email.includes('@') ? email.split('@')[0] : email
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
