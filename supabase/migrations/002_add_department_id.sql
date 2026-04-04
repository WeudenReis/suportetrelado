-- ============================================================
-- Migration 002: Adicionar department_id em todas as tabelas de negócio
-- Execução: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- IMPORTANTE: Executar DEPOIS da migration 001
-- ============================================================

-- IDs padrão criados na migration 001
-- Org:  00000000-0000-0000-0000-000000000001
-- Dept: 00000000-0000-0000-0000-000000000010

-- ── tickets ──
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE tickets SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE tickets ALTER COLUMN department_id SET NOT NULL;

-- ── comments ──
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE comments SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE comments ALTER COLUMN department_id SET NOT NULL;

-- ── attachments ──
ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE attachments SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE attachments ALTER COLUMN department_id SET NOT NULL;

-- ── activity_log ──
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE activity_log SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE activity_log ALTER COLUMN department_id SET NOT NULL;

-- ── board_columns ──
ALTER TABLE board_columns
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE board_columns SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE board_columns ALTER COLUMN department_id SET NOT NULL;

-- ── board_labels ──
ALTER TABLE board_labels
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE board_labels SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE board_labels ALTER COLUMN department_id SET NOT NULL;

-- ── notifications ──
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE notifications SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE notifications ALTER COLUMN department_id SET NOT NULL;

-- ── announcements ──
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE announcements SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE announcements ALTER COLUMN department_id SET NOT NULL;

-- ── useful_links ──
ALTER TABLE useful_links
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

UPDATE useful_links SET department_id = '00000000-0000-0000-0000-000000000010'
WHERE department_id IS NULL;

ALTER TABLE useful_links ALTER COLUMN department_id SET NOT NULL;

-- ── user_profiles (vínculo com org, não dept — um user pode estar em vários depts) ──
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE user_profiles SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE user_profiles ALTER COLUMN organization_id SET NOT NULL;

-- ── planner_events (pessoal por user, mas dentro da org) ──
ALTER TABLE planner_events
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE planner_events SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE planner_events ALTER COLUMN organization_id SET NOT NULL;

-- ── planner_notification_settings (pessoal por user, dentro da org) ──
ALTER TABLE planner_notification_settings
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE planner_notification_settings SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE planner_notification_settings ALTER COLUMN organization_id SET NOT NULL;
