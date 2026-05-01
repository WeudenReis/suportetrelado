import { supabase } from '../supabase'
import { logger } from '../logger'
import type { Notification, PaginationOptions } from '../supabase'
import { fetchUserProfiles } from './users'
import { extractMentionDisplayNames } from '../mentions'

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

export async function insertNotification(notif: Omit<Notification, 'id' | 'is_read' | 'created_at'>): Promise<boolean> {
  const { error } = await supabase.from('notifications').insert(notif as Record<string, unknown>)
  if (error) {
    logger.warn('Notifications', 'insertNotification falhou', { error: error.message })
    return false
  }
  return true
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

export async function deleteNotificationsByTicket(ticketId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('ticket_id', ticketId)
  if (error) logger.warn('Notifications', 'deleteNotificationsByTicket falhou', { error: error.message })
}

export function extractMentionNames(text: string): string[] {
  return extractMentionDisplayNames(text)
}

export async function resolveMentionsToEmails(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const profiles = await fetchUserProfiles()
  const emails: string[] = []
  const normalize = (s: string) => s
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  for (const name of names) {
    const n = normalize(name)

    // 1) Match exato: nome completo ou alias (email prefix)
    const exact = profiles.find(p =>
      normalize(p.name) === n ||
      normalize(p.email.split('@')[0]) === n
    )
    if (exact) {
      emails.push(exact.email)
      continue
    }

    // 2) Match por melhor prefixo: tolera texto extra após o nome/alias (ex.: "rafael the boss oi")
    let best: { email: string; score: number } | null = null
    for (const p of profiles) {
      const pn = normalize(p.name)
      if (pn && (n === pn || n.startsWith(pn + ' '))) {
        const score = pn.length
        if (!best || score > best.score) best = { email: p.email, score }
      }

      const alias = normalize(p.email.split('@')[0])
      if (alias && (n === alias || n.startsWith(alias + ' '))) {
        const score = alias.length
        if (!best || score > best.score) best = { email: p.email, score }
      }
    }
    if (best) emails.push(best.email)
  }

  return [...new Set(emails)]
}
