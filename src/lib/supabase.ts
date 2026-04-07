import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ── Client Supabase ──────────────────────────────────────────
const supabaseUrlDev = (import.meta.env.VITE_SUPABASE_URL_DEV || '').trim().replace(/\/+$/, '')
const supabaseAnonKeyDev = (import.meta.env.VITE_SUPABASE_ANON_KEY_DEV || '').trim()
const supabaseUrlProd = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const supabaseAnonKeyProd = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

const supabaseUrl = supabaseUrlDev || supabaseUrlProd
const supabaseAnonKey = supabaseUrlDev ? supabaseAnonKeyDev || supabaseAnonKeyProd : supabaseAnonKeyProd

function createSafeClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    const msg = 'VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidas. Verifique seu .env'
    console.error('[Supabase] ' + msg)
    // Exibir erro visual para o usuário ao invés de crashar silenciosamente
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = `<div style="padding:40px;color:#f87171;background:#1d2125;min-height:100vh;font-family:monospace">
        <h2>⚠️ Erro de Configuração</h2>
        <p style="color:#94a3b8">As variáveis de ambiente do Supabase não estão configuradas.</p>
        <p style="color:#94a3b8">Verifique <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no painel da Vercel (Settings → Environment Variables) com escopo <strong>Preview</strong>.</p>
      </div>`
    }
    // Criar client com placeholder para evitar crash — nenhuma query funcionará
    return createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSafeClient()
export const isDevEnvironment = Boolean(supabaseUrlDev) || !supabaseUrlProd.includes('qacrxpfoamarslxskcyb')

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
  department_id: string
  ticket_id: string
  file_name: string
  file_url: string
  file_type: string
  uploaded_by: string | null
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
  user_email: string
  notify_days_before: number[]
  created_at: string
  updated_at: string
}

// ── Re-exports de todos os modulos de API ────────────────────
// Manter compatibilidade com imports existentes de './lib/supabase'
export {
  fetchTickets, insertTicket, updateTicket, deleteTicket,
  fetchComments, insertComment, deleteComment,
  fetchAttachmentCounts, fetchAttachments, uploadAttachment, getSignedAttachmentUrl, deleteAttachment,
  fetchActivityLog, insertActivityLog,
  checkAuthorizedUser, upsertUserProfile, updateLastSeen, fetchUserProfiles,
  fetchNotifications, insertNotification, markNotificationRead, markAllNotificationsRead, extractMentionNames, resolveMentionsToEmails,
  fetchAnnouncements, insertAnnouncement, updateAnnouncement, deleteAnnouncement,
  fetchUsefulLinks, insertUsefulLink, updateUsefulLink, deleteUsefulLink,
  fetchBoardLabels, insertBoardLabel, updateBoardLabel, deleteBoardLabel,
  fetchPlannerEvents, insertPlannerEvent, updatePlannerEvent, deletePlannerEvent, fetchPlannerSettings, upsertPlannerSettings,
} from './api'
