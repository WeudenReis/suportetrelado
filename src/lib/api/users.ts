import { supabase, isDevEnvironment } from '../supabase'
import { logger } from '../logger'
import type { UserProfile } from '../supabase'

const AVATAR_COLORS = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']

const DEV_ADMIN_EMAILS = (import.meta.env.VITE_DEV_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

/** Emails com acesso garantido de admin (bypass de autorização) */
const ALWAYS_AUTHORIZED_ADMINS: readonly string[] = ['weudenfilho@gmail.com']

function isAlwaysAuthorizedAdmin(email: string): boolean {
  return ALWAYS_AUTHORIZED_ADMINS.includes(email.toLowerCase().trim())
}

function hasDevAdminOverride(email: string): boolean {
  const normalized = email.toLowerCase()
  return DEV_ADMIN_EMAILS.includes(normalized) || isAlwaysAuthorizedAdmin(normalized)
}

function isDevAuthorizedEmail(email: string): boolean {
  if (hasDevAdminOverride(email)) return true
  if (!isDevEnvironment) return false
  return DEV_ADMIN_EMAILS.length === 0
}

export async function checkAuthorizedUser(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim()

  // Bypass ABSOLUTO para super admins — sem nenhuma query ao banco
  if (ALWAYS_AUTHORIZED_ADMINS.includes(normalizedEmail)) {
    return true
  }

  if (isDevAuthorizedEmail(normalizedEmail)) {
    return true
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (error) {
      logger.warn('UserProfiles', 'checkAuthorizedUser falhou', { error: error.message })
      // Se a query falhar (ex: RLS recursion), admins já passaram acima
      return false
    }
    return !!data
  } catch (err) {
    logger.warn('UserProfiles', 'checkAuthorizedUser exceção', { error: String(err) })
    return false
  }
}

export async function upsertUserProfile(email: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const fullName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || ''
  const firstName = fullName ? fullName.split(' ')[0] : (email.includes('@') ? email.split('@')[0] : email)
  const name = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  const devRole = isAlwaysAuthorizedAdmin(email) || isDevAuthorizedEmail(email) ? 'admin' : undefined
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
