import { createContext, useContext } from 'react'
import type { Announcement, AnnouncementSeverity } from '../lib/supabase'

export interface AnnouncementContextProps {
  announcements: Announcement[]
  loading: boolean
  addAnnouncement: (data: { title: string; content: string; severity: AnnouncementSeverity; author: string; is_pinned: boolean }) => Promise<Announcement | null>
  togglePin: (ann: Announcement) => Promise<void>
  removeAnnouncement: (id: string) => Promise<void>
}

export const AnnouncementContext = createContext<AnnouncementContextProps | undefined>(undefined)

export const useAnnouncementContext = () => {
  const ctx = useContext(AnnouncementContext)
  if (!ctx) throw new Error('useAnnouncementContext must be used within AnnouncementProvider')
  return ctx
}
