import { useEffect, useState } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import type { UserProfile } from '../lib/supabase'

/**
 * Carrega a lista de membros (user_profiles) e mantém sincronizada via realtime.
 * Atualizações remotas são debounced em 30s para evitar flood de re-fetch.
 */
export function useKanbanMembers(): { allMembers: UserProfile[] } {
  const [allMembers, setAllMembers] = useState<UserProfile[]>([])

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

  return { allMembers }
}
