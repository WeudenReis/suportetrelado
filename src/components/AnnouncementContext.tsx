import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  supabase,
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  type Announcement, type AnnouncementSeverity,
} from '../lib/supabase'
import { logger } from '../lib/logger'
import { useOrg } from '../lib/org'

interface AnnouncementContextProps {
  announcements: Announcement[]
  loading: boolean
  addAnnouncement: (data: { title: string; content: string; severity: AnnouncementSeverity; author: string; is_pinned: boolean }) => Promise<Announcement | null>
  togglePin: (ann: Announcement) => Promise<void>
  removeAnnouncement: (id: string) => Promise<void>
}

const AnnouncementContext = createContext<AnnouncementContextProps | undefined>(undefined)

export const useAnnouncementContext = () => {
  const ctx = useContext(AnnouncementContext)
  if (!ctx) throw new Error('useAnnouncementContext must be used within AnnouncementProvider')
  return ctx
}

export const AnnouncementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const { currentDepartment } = useOrg()
  const departmentId = currentDepartment?.id

  const load = useCallback(async () => {
    if (!departmentId) return
    try {
      const data = await fetchAnnouncements(departmentId)
      setAnnouncements(data)
    } catch (err) {
      logger.warn('Announcements', 'Falha ao carregar', { error: String(err) })
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    if (!departmentId) return
    load()

    const channel = supabase
      .channel('announcement-context')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `department_id=eq.${departmentId}` }, payload => {
        setAnnouncements(prev => {
          if (prev.some(a => a.id === (payload.new as Announcement).id)) return prev
          return [payload.new as Announcement, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements', filter: `department_id=eq.${departmentId}` }, payload => {
        setAnnouncements(prev =>
          prev.map(a => a.id === (payload.new as Announcement).id ? payload.new as Announcement : a)
        )
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements', filter: `department_id=eq.${departmentId}` }, payload => {
        setAnnouncements(prev => prev.filter(a => a.id !== (payload.old as Announcement).id))
      })
      .subscribe()

    // Polling de 30s como fallback caso o realtime não esteja habilitado na tabela
    const interval = setInterval(load, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [load, departmentId])

  const addAnnouncement = useCallback(async (data: {
    title: string; content: string; severity: AnnouncementSeverity; author: string; is_pinned: boolean
  }): Promise<Announcement | null> => {
    if (!departmentId) return null
    const ann = await insertAnnouncement({ ...data, department_id: departmentId })
    if (ann) {
      setAnnouncements(prev => {
        if (prev.some(a => a.id === ann.id)) return prev
        return [ann, ...prev]
      })
    }
    return ann
  }, [departmentId])

  const togglePin = useCallback(async (ann: Announcement) => {
    const next = !ann.is_pinned
    setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, is_pinned: next } : a))
    await updateAnnouncement(ann.id, { is_pinned: next })
  }, [])

  const removeAnnouncement = useCallback(async (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    await deleteAnnouncement(id)
  }, [])

  return (
    <AnnouncementContext.Provider value={{ announcements, loading, addAnnouncement, togglePin, removeAnnouncement }}>
      {children}
    </AnnouncementContext.Provider>
  )
}
