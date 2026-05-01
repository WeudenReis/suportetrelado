import { vi } from 'vitest'

// Mock do cliente Supabase
const channelMock = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn((cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED')
    return channelMock
  }),
  unsubscribe: vi.fn(),
  track: vi.fn().mockResolvedValue(undefined),
  presenceState: vi.fn().mockReturnValue({}),
}

export const supabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  channel: vi.fn().mockReturnValue(channelMock),
  removeChannel: vi.fn(),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://fake.url' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://fake.url' } }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
}

export const isDevEnvironment = true

// ── Funções mock do serviço ──
export const fetchBoardLabels = vi.fn().mockResolvedValue([])
export const insertBoardLabel = vi.fn().mockResolvedValue({ id: 'label-1', name: 'Test', color: '#579dff', department_id: '', created_at: '', updated_at: '' })
export const updateBoardLabel = vi.fn().mockResolvedValue(undefined)
export const deleteBoardLabel = vi.fn().mockResolvedValue(undefined)

export const fetchTickets = vi.fn().mockResolvedValue([])
export const insertTicket = vi.fn().mockImplementation(async (ticket) => ({
  id: `ticket-${Date.now()}`,
  department_id: ticket.department_id || '',
  title: ticket.title,
  description: ticket.description || '',
  status: ticket.status || 'backlog',
  priority: ticket.priority || 'medium',
  assignee: ticket.assignee || null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tags: ticket.tags || [],
  is_archived: false,
  is_completed: false,
  attachment_count: 0,
}))
export const updateTicket = vi.fn().mockImplementation(async (id, updates) => ({
  id,
  title: 'Updated',
  status: 'backlog',
  priority: 'medium',
  ...updates,
  department_id: '',
  description: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}))
export const deleteTicket = vi.fn().mockResolvedValue(undefined)

export const fetchComments = vi.fn().mockResolvedValue([])
export const insertComment = vi.fn().mockResolvedValue({ id: 'comment-1', ticket_id: '', user_name: '', content: '', created_at: '', department_id: '' })
export const deleteComment = vi.fn().mockResolvedValue(undefined)

export const fetchAttachmentCounts = vi.fn().mockResolvedValue({})
export const fetchAttachments = vi.fn().mockResolvedValue([])
export const uploadAttachment = vi.fn().mockResolvedValue(null)
export const getSignedAttachmentUrl = vi.fn().mockResolvedValue('https://fake.url')
export const deleteAttachment = vi.fn().mockResolvedValue(undefined)

export const fetchActivityLog = vi.fn().mockResolvedValue([])
export const insertActivityLog = vi.fn().mockResolvedValue(null)

export const checkAuthorizedUser = vi.fn().mockResolvedValue(true)
export const upsertUserProfile = vi.fn().mockResolvedValue(undefined)
export const updateLastSeen = vi.fn().mockResolvedValue(undefined)
export const fetchUserProfiles = vi.fn().mockResolvedValue([])

export const fetchNotifications = vi.fn().mockResolvedValue([])
export const insertNotification = vi.fn().mockResolvedValue(undefined)
export const markNotificationRead = vi.fn().mockResolvedValue(undefined)
export const markAllNotificationsRead = vi.fn().mockResolvedValue(undefined)

export const extractMentionNames = vi.fn().mockReturnValue([])
export const resolveMentionsToEmails = vi.fn().mockResolvedValue([])

export const fetchAnnouncements = vi.fn().mockResolvedValue([])
export const insertAnnouncement = vi.fn().mockResolvedValue(null)
export const updateAnnouncement = vi.fn().mockResolvedValue(undefined)
export const deleteAnnouncement = vi.fn().mockResolvedValue(undefined)

export const fetchUsefulLinks = vi.fn().mockResolvedValue([])
export const insertUsefulLink = vi.fn().mockResolvedValue(null)
export const updateUsefulLink = vi.fn().mockResolvedValue(undefined)
export const deleteUsefulLink = vi.fn().mockResolvedValue(undefined)

export const fetchPlannerEvents = vi.fn().mockResolvedValue([])
export const insertPlannerEvent = vi.fn().mockResolvedValue(null)
export const updatePlannerEvent = vi.fn().mockResolvedValue(undefined)
export const deletePlannerEvent = vi.fn().mockResolvedValue(undefined)
export const fetchPlannerSettings = vi.fn().mockResolvedValue(null)
export const upsertPlannerSettings = vi.fn().mockResolvedValue(undefined)

// Re-exportar tipos (são passthrough)
export type { Ticket, TicketStatus, TicketPriority, TicketInsert, Comment, Attachment, ActivityLog, BoardLabel, UserProfile, Notification, Announcement, AnnouncementSeverity, UsefulLink, PlannerEvent, PlannerNotificationSettings, PaginationOptions } from '../../lib/supabase'
