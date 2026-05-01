import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Rastreia presença (usuários online no quadro) via canal `online-users` do Supabase.
 * Cada usuário se identifica pelo e-mail e publica `online_at`.
 */
export function useKanbanPresence(user: string): { onlineUsers: string[] } {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])

  useEffect(() => {
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: user } },
    })

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      setOnlineUsers(Object.keys(state))
    })

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ user, online_at: new Date().toISOString() })
      }
    })

    return () => { supabase.removeChannel(presenceChannel) }
  }, [user])

  return { onlineUsers }
}
