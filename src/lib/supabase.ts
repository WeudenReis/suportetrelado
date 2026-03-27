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

export type TicketInsert = Omit<Ticket, 'id' | 'created_at' | 'updated_at'>

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
