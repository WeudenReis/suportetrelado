-- ============================================================
-- Migration 005: Indexes para consultas frequentes
-- Execução: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- IMPORTANTE: Executar DEPOIS da migration 002
-- ============================================================

-- ── tickets ──
CREATE INDEX IF NOT EXISTS idx_tickets_department ON tickets(department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_dept_status ON tickets(department_id, status) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_tickets_dept_archived ON tickets(department_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_due_date ON tickets(due_date) WHERE due_date IS NOT NULL;

-- ── comments ──
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_comments_department ON comments(department_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- ── attachments ──
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_department ON attachments(department_id);

-- ── activity_log ──
CREATE INDEX IF NOT EXISTS idx_activity_log_card ON activity_log(card_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_department ON activity_log(department_id);

-- ── board_columns ──
CREATE INDEX IF NOT EXISTS idx_board_columns_department ON board_columns(department_id);
CREATE INDEX IF NOT EXISTS idx_board_columns_dept_position ON board_columns(department_id, position) WHERE is_archived = false;

-- ── board_labels ──
CREATE INDEX IF NOT EXISTS idx_board_labels_department ON board_labels(department_id);

-- ── notifications ──
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_dept ON notifications(department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_email, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ── announcements ──
CREATE INDEX IF NOT EXISTS idx_announcements_department ON announcements(department_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, department_id);

-- ── useful_links ──
CREATE INDEX IF NOT EXISTS idx_useful_links_department ON useful_links(department_id);
CREATE INDEX IF NOT EXISTS idx_useful_links_category ON useful_links(category);

-- ── user_profiles ──
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- ── planner_events ──
CREATE INDEX IF NOT EXISTS idx_planner_events_user ON planner_events(user_email);
CREATE INDEX IF NOT EXISTS idx_planner_events_date ON planner_events(date);
CREATE INDEX IF NOT EXISTS idx_planner_events_org ON planner_events(organization_id);
