import { supabase } from '../supabase'
import { logger } from '../logger'
import type { Notification, PaginationOptions } from '../supabase'
import { fetchUserProfiles } from './users'

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
  if (error) { logger.warn('Notifications', 'Tabela notifications pode não existir', { error: error.message }); return [] }
  return (data ?? []) as Notification[]
}

export async function insertNotification(notif: Omit<Notification, 'id' | 'is_read' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('notifications').insert(notif as Record<string, unknown>)
  if (error) logger.warn('Notifications', 'insertNotification falhou', { error: error.message })
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markAllNotificationsRead(email: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('recipient_email', email).eq('is_read', false)
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) logger.warn('Notifications', 'deleteNotification falhou', { error: error.message })
}

export async function deleteAllNotifications(email: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('recipient_email', email)
  if (error) logger.warn('Notifications', 'deleteAllNotifications falhou', { error: error.message })
}

export async function deleteNotificationsByTicket(ticketId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('ticket_id', ticketId)
    .eq('recipient_email', email)
  if (error) logger.warn('Notifications', 'deleteNotificationsByTicket falhou', { error: error.message })
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
