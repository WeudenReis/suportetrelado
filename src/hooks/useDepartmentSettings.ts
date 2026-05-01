import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../lib/orgContext'
import {
  DEFAULT_DEPARTMENT_SETTINGS,
  mergeDepartmentSettings,
  type DepartmentSettings,
} from '../lib/departmentSettings'
import { logger } from '../lib/logger'

interface UseDepartmentSettingsReturn {
  settings: DepartmentSettings
  loading: boolean
  refresh: () => Promise<void>
  save: (next: DepartmentSettings) => Promise<{ error: string | null }>
}

export function useDepartmentSettings(): UseDepartmentSettingsReturn {
  const { departmentId } = useOrg()
  const [settings, setSettings] = useState<DepartmentSettings>(DEFAULT_DEPARTMENT_SETTINGS)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!departmentId) {
      setSettings(DEFAULT_DEPARTMENT_SETTINGS)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('settings')
        .eq('id', departmentId)
        .maybeSingle()
      if (error) {
        logger.warn('DepartmentSettings', 'Falha ao carregar settings', { error: error.message })
        setSettings(DEFAULT_DEPARTMENT_SETTINGS)
        return
      }
      setSettings(mergeDepartmentSettings(data?.settings))
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!departmentId) return
    const channel = supabase
      .channel(`dept_settings:${departmentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'departments', filter: `id=eq.${departmentId}` },
        payload => {
          const next = (payload.new as { settings?: unknown } | null)?.settings
          setSettings(mergeDepartmentSettings(next))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [departmentId])

  const save = useCallback(
    async (next: DepartmentSettings): Promise<{ error: string | null }> => {
      if (!departmentId) return { error: 'Nenhum departamento ativo' }
      const { error } = await supabase
        .from('departments')
        .update({ settings: next })
        .eq('id', departmentId)
      if (error) {
        logger.error('DepartmentSettings', 'Falha ao salvar settings', { error: error.message })
        return { error: error.message }
      }
      setSettings(next)
      return { error: null }
    },
    [departmentId]
  )

  return { settings, loading, refresh: load, save }
}
