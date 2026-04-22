import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ── Client Supabase ──────────────────────────────────────────
const supabaseUrlDev = (import.meta.env.VITE_SUPABASE_URL_DEV || '').trim().replace(/\/+$/, '')
const supabaseAnonKeyDev = (import.meta.env.VITE_SUPABASE_ANON_KEY_DEV || '').trim()
const supabaseUrlProd = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const supabaseAnonKeyProd = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

const supabaseUrl = supabaseUrlDev || supabaseUrlProd
const supabaseAnonKey = supabaseUrlDev ? supabaseAnonKeyDev || supabaseAnonKeyProd : supabaseAnonKeyProd

/** Indica se as env vars do Supabase estão configuradas */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function createSafeClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    // logger não disponível aqui (módulo de bootstrap) — console intencional
    console.error('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidas. Verifique as env vars da Vercel.')
    // Client dummy para evitar crash em imports — auth/queries não funcionarão
    return createClient('https://localhost', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSafeClient()
export const isDevEnvironment = import.meta.env.DEV || Boolean(supabaseUrlDev) || !supabaseUrlProd.includes('qacrxpfoamarslxskcyb')

// ── Types ────────────────────────────────────────────────────
export type TicketStatus = string
export type TicketPriority = 'low' | 'medium' | 'high'

export interface PaginationOptions {
  page?: number
  pageSize?: number
}

export interface Ticket {
  id: string
  department_id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignee?: string | null
  created_at: string
  updated_at: string
  tags?: string[] | null
  cliente?: string | null
  instancia?: string | null
  link_retaguarda?: string | null
  link_sessao?: string | null
  observacao?: string | null
  due_date?: string | null
  cover_image_url?: string | null
  cover_thumb_url?: string | null
  is_archived?: boolean
  is_completed?: boolean
  attachment_count?: number
}

export interface Comment {
  id: string
  department_id: string
  ticket_id: string
  user_name: string
  content: string
  created_at: string
}

export interface Attachment {
  id: string
  department_id: string | null
  ticket_id: string
  file_name: string
  file_url: string
  file_type: string
  uploaded_by: string | null
  storage_path: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  department_id: string
  card_id: string
  user_name: string
  action_text: string
  created_at: string
}

export type TicketInsert = {
  department_id: string
  title: string
  description?: string
  status?: TicketStatus
  priority?: TicketPriority
  assignee?: string | null
  tags?: string[] | null
  cliente?: string | null
  instancia?: string | null
  link_retaguarda?: string | null
  link_sessao?: string | null
  observacao?: string | null
}

export interface BoardLabel {
  id: string
  department_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  organization_id: string
  email: string
  name: string
  avatar_color: string
  role: string
  last_seen_at: string
  created_at: string
}

export interface Notification {
  id: string
  department_id: string
  recipient_email: string
  sender_name: string
  type: 'mention' | 'assignment' | 'move' | 'comment' | 'announcement' | 'due_date_alert' | 'planner_event'
  ticket_id: string | null
  ticket_title: string
  message: string
  is_read: boolean
  created_at: string
}

export type AnnouncementSeverity = 'info' | 'warning' | 'critical'

export interface Announcement {
  id: string
  department_id: string
  title: string
  content: string
  severity: AnnouncementSeverity
  author: string
  is_pinned: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UsefulLink {
  id: string
  department_id: string
  title: string
  url: string
  description: string
  category: string
  icon: string
  added_by: string
  created_at: string
  updated_at: string
}

export interface PlannerEvent {
  id: string
  organization_id: string
  user_email: string
  title: string
  description: string
  date: string
  start_time: string | null
  end_time: string | null
  color: string
  created_at: string
  updated_at: string
}

export interface PlannerNotificationSettings {
  id: string
  organization_id: string
  user_email: string
  notify_days_before: number[]
  created_at: string
  updated_at: string
}

// ── Re-exports de todos os modulos de API ────────────────────
// Manter compatibilidade com imports existentes de './lib/supabase'
export {
  fetchTickets, fetchTicketsCount, insertTicket, updateTicket, deleteTicket,
  fetchComments, insertComment, deleteComment,
  fetchAttachmentCounts, fetchAttachments, uploadAttachment, getSignedAttachmentUrl, deleteAttachment,
  fetchActivityLog, insertActivityLog,
  checkAuthorizedUser, upsertUserProfile, updateLastSeen, fetchUserProfiles,
  fetchNotifications, insertNotification, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllNotifications, deleteNotificationsByTicket, extractMentionNames, resolveMentionsToEmails,
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  fetchUsefulLinks, insertUsefulLink, updateUsefulLink, deleteUsefulLink,
  fetchBoardLabels, insertBoardLabel, updateBoardLabel, deleteBoardLabel,
  fetchPlannerEvents, insertPlannerEvent, updatePlannerEvent, deletePlannerEvent, fetchPlannerSettings, upsertPlannerSettings,
} from './api'
