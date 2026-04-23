import { useEffect, useState } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import type { UserProfile } from '../lib/supabase'
import { bestRoleFrom, type OrgRole } from '../lib/orgContext'

/**
 * Carrega a lista de membros (user_profiles) e seus roles efetivos por email,
 * resolvidos a partir de org_members + bestRoleFrom (fonte de verdade do RBAC).
 * Mantém ambos sincronizados via realtime; user_profiles é debounced em 30s.
 */
export function useKanbanMembers(organizationId?: string | null): {
  allMembers: UserProfile[]
  memberRoles: Map<string, OrgRole>
} {
  const [allMembers, setAllMembers] = useState<UserProfile[]>([])
  const [memberRoles, setMemberRoles] = useState<Map<string, OrgRole>>(new Map())

  useEffect(() => {
    fetchUserProfiles().then(setAllMembers)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const ch = supabase
      .channel('user_profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          fetchUserProfiles().then(setAllMembers)
        }, 30000)
      })
      .subscribe()
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(ch)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadRoles = async () => {
      if (!organizationId) {
        if (!cancelled) setMemberRoles(new Map())
        return
      }
      const { data } = await supabase
        .from('org_members')
        .select('user_email, role')
        .eq('organization_id', organizationId)
      if (cancelled) return
      const grouped = new Map<string, { role: string }[]>()
      for (const row of data ?? []) {
        const arr = grouped.get(row.user_email) ?? []
        arr.push({ role: row.role })
        grouped.set(row.user_email, arr)
      }
      const next = new Map<string, OrgRole>()
      for (const [email, rows] of grouped) next.set(email, bestRoleFrom(rows))
      setMemberRoles(next)
    }

    loadRoles()
    if (!organizationId) return () => { cancelled = true }

    const ch = supabase
      .channel(`org_members_roles_${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_members', filter: `organization_id=eq.${organizationId}` }, loadRoles)
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [organizationId])

  return { allMembers, memberRoles }
}
