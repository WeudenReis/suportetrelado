import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  supabase,
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  type Announcement, type AnnouncementSeverity,
} from '../lib/supabase'

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

  const load = useCallback(async () => {
    try {
      const data = await fetchAnnouncements()
      setAnnouncements(data)
    } catch (err) {
      console.warn('[Announcements] Falha ao carregar:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('announcement-context')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, payload => {
        setAnnouncements(prev => {
          if (prev.some(a => a.id === (payload.new as Announcement).id)) return prev
          return [payload.new as Announcement, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements' }, payload => {
        setAnnouncements(prev =>
          prev.map(a => a.id === (payload.new as Announcement).id ? payload.new as Announcement : a)
        )
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, payload => {
        setAnnouncements(prev => prev.filter(a => a.id !== (payload.old as Announcement).id))
      })
      .subscribe()

    // Polling de 30s como fallback caso o realtime não esteja habilitado na tabela
    const interval = setInterval(load, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [load])

  const addAnnouncement = useCallback(async (data: {
    title: string; content: string; severity: AnnouncementSeverity; author: string; is_pinned: boolean
  }): Promise<Announcement | null> => {
    const ann = await insertAnnouncement(data)
    if (ann) {
      setAnnouncements(prev => {
        if (prev.some(a => a.id === ann.id)) return prev
        return [ann, ...prev]
      })
    }
    return ann
  }, [])

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
