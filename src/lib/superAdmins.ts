/**
 * Fonte única de verdade para super admins do chatPro.
 * Esses emails têm bypass absoluto: ignoram checagens de `user_profiles`,
 * `org_members` e RLS, e são tratados como admin da organização padrão.
 *
 * Usados em:
 * - `lib/api/users.ts` — bypass de `checkAuthorizedUser`
 * - `lib/org.tsx` — fallback quando não há registro em `org_members`
 * - `App.tsx` — bypass no fluxo de autenticação
 */
export const SUPER_ADMIN_EMAILS: readonly string[] = [
  'weudenfilho@gmail.com',
  'wandersonthegod@gmail.com',
]

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim())
}
