import { createContext, useContext } from 'react'
import type { Notification } from '../lib/supabase'

export interface NotificationContextProps {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  refreshNotifications: () => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  toastNotification: Notification | null
  dismissToast: () => void
}

export const NotificationContext = createContext<NotificationContextProps | undefined>(undefined)

export const useNotificationContext = () => {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotificationContext must be used within NotificationProvider')
  return ctx
}
