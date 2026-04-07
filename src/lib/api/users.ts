import { supabase, isDevEnvironment } from '../supabase'
import { logger } from '../logger'
import type { UserProfile } from '../supabase'

const AVATAR_COLORS = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']

const DEV_ADMIN_EMAILS = (import.meta.env.VITE_DEV_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

function hasDevAdminOverride(email: string): boolean {
  return DEV_ADMIN_EMAILS.includes(email.toLowerCase())
}

function isDevAuthorizedEmail(email: string): boolean {
  if (hasDevAdminOverride(email)) return true
  if (!isDevEnvironment) return false
  return DEV_ADMIN_EMAILS.length === 0
}

export async function checkAuthorizedUser(email: string): Promise<boolean> {
  if (isDevAuthorizedEmail(email)) {
    return true
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (error) { logger.warn('UserProfiles', 'checkAuthorizedUser falhou', { error: error.message }); return false }
  return !!data
}

export async function upsertUserProfile(email: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const fullName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || ''
  const firstName = fullName ? fullName.split(' ')[0] : (email.includes('@') ? email.split('@')[0] : email)
  const name = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  const devRole = isDevAuthorizedEmail(email) ? 'admin' : undefined
  const payload = {
    email,
    name,
    avatar_color: color,
    last_seen_at: new Date().toISOString(),
    ...(devRole ? { role: devRole } : {}),
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'email' })
  if (error) logger.warn('UserProfiles', 'upsertUserProfile falhou', { error: error.message })
}

export async function updateLastSeen(email: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('email', email)
  if (error) logger.warn('UserProfiles', 'updateLastSeen falhou', { error: error.message })
}

export async function fetchUserProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('last_seen_at', { ascending: false })
  if (error) { logger.warn('UserProfiles', 'Tabela user_profiles pode não existir', { error: error.message }); return [] }
  return (data ?? []) as UserProfile[]
}
