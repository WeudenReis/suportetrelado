import React, { useState, useEffect, useCallback } from 'react'
import {
  supabase,
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  deleteAnnouncementAttachmentObject,
  type Announcement, type AnnouncementAttachment, type AnnouncementSeverity,
} from '../lib/supabase'
import { logger } from '../lib/logger'
import { useOrg } from '../lib/orgContext'
import { AnnouncementContext } from './useAnnouncementContext'

export const AnnouncementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const { departmentId } = useOrg()

  const load = useCallback(async () => {
    if (!departmentId) {
      setAnnouncements([])
      setLoading(false)
      return
    }
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
    if (!departmentId) {
      setLoading(false)
      return
    }
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
    attachments?: AnnouncementAttachment[]
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
    const target = announcements.find(a => a.id === id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    await deleteAnnouncement(id)
    // Limpa objetos do Storage para evitar arquivos órfãos no bucket
    if (target?.attachments?.length) {
      await Promise.all(target.attachments.map(a => deleteAnnouncementAttachmentObject(a.storage_path)))
    }
  }, [announcements])

  return (
    <AnnouncementContext.Provider value={{ announcements, loading, addAnnouncement, togglePin, removeAnnouncement }}>
      {children}
    </AnnouncementContext.Provider>
  )
}
