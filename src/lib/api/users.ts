import { supabase, isDevEnvironment } from '../supabase'
import { logger } from '../logger'
import { SUPER_ADMIN_EMAILS, isSuperAdmin } from '../superAdmins'
import type { UserProfile } from '../supabase'

const AVATAR_COLORS = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']

const DEV_ADMIN_EMAILS = (import.meta.env.VITE_DEV_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

function hasDevAdminOverride(email: string): boolean {
  const normalized = email.toLowerCase()
  return DEV_ADMIN_EMAILS.includes(normalized) || isSuperAdmin(normalized)
}

function isDevAuthorizedEmail(email: string): boolean {
  if (hasDevAdminOverride(email)) return true
  if (!isDevEnvironment) return false
  return DEV_ADMIN_EMAILS.length === 0
}

export async function checkAuthorizedUser(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim()

  // Bypass ABSOLUTO para super admins — sem nenhuma query ao banco
  if (SUPER_ADMIN_EMAILS.includes(normalizedEmail)) {
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
  // Descobre a organization_id vinculada ao e-mail em org_members.
  // Se o admin ainda não vinculou o usuário à equipe, cancela silenciosamente
  // para que o OrgGate direcione ao PendingAccessScreen ("Acesso em Configuração").
  const { data: membership } = await supabase
    .from('org_members')
    .select('organization_id')
    .eq('user_email', email)
    .limit(1)
    .maybeSingle()

  const organizationId = membership?.organization_id as string | undefined
  if (!organizationId) return // early-return silencioso

  const { data: { session } } = await supabase.auth.getSession()
  const fullName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || ''
  const name = fullName.trim() || (email.includes('@') ? email.split('@')[0] : email)
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  const devRole = isSuperAdmin(email) || isDevAuthorizedEmail(email) ? 'admin' : undefined
  
  // Verifica se o perfil já existe para não sobrescrever `name` ou `avatar_color` customizados
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile) {
    // Atualiza apenas dados sistêmicos
    const updatePayload: Record<string, any> = {
      organization_id: organizationId,
      last_seen_at: new Date().toISOString()
    }
    if (devRole) updatePayload.role = devRole

    const { error: updateErr } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('email', email)
    if (updateErr) logger.warn('UserProfiles', 'falha no update', { error: updateErr.message })
    return
  }

  // Se não existir, fazemos o INSERT completo do novo usuário
  const payload = {
    email,
    name,
    avatar_color: color,
    organization_id: organizationId,
    last_seen_at: new Date().toISOString(),
    ...(devRole ? { role: devRole } : {}),
  }

  const { error } = await supabase
    .from('user_profiles')
    .insert(payload)
  
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
