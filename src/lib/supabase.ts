import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
}

export async function fetchTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
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
  if (error) throw error
  return data as Ticket
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
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

export async function sendToSlack(ticket: Ticket): Promise<boolean> {
  const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('VITE_SLACK_WEBHOOK_URL not set in .env')
    return false
  }

  const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }
  const statusLabel: Record<TicketStatus, string> = {
    backlog: 'Backlog',
    in_progress: 'Em Progresso',
    waiting_devs: 'Aguardando Devs',
    resolved: 'Resolvido',
  }

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${priorityEmoji[ticket.priority]} Ticket de Alta Prioridade`, emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Título:*\n${ticket.title}` },
          { type: 'mrkdwn', text: `*Prioridade:*\n${ticket.priority.toUpperCase()}` },
          { type: 'mrkdwn', text: `*Status:*\n${statusLabel[ticket.status]}` },
          { type: 'mrkdwn', text: `*Responsável:*\n${ticket.assignee || 'Não atribuído'}` },
        ]
      },
      ...(ticket.description ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*Descrição:*\n${ticket.description}` }
      }] : []),
    ]
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch (err) {
    console.error('Failed to send to Slack:', err)
    return false
  }
}
