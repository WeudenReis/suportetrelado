-- ============================================================
-- Migration 004: RLS Policies — Isolamento por departamento
-- Execução: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- IMPORTANTE: Executar DEPOIS das migrations 001, 002 e 003
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ATIVAR RLS EM TODAS AS TABELAS                         ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE useful_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ORGANIZATIONS — apenas membros podem ver sua org        ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "org_select" ON organizations FOR SELECT USING (
  EXISTS (SELECT 1 FROM org_members WHERE organization_id = organizations.id AND user_email = auth_email())
);
CREATE POLICY "org_update_admin" ON organizations FOR UPDATE USING (
  get_user_role(id) = 'admin'
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  DEPARTMENTS — membros da org veem; admin gerencia       ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "dept_select" ON departments FOR SELECT USING (
  EXISTS (SELECT 1 FROM org_members WHERE organization_id = departments.organization_id AND user_email = auth_email())
);
CREATE POLICY "dept_insert_admin" ON departments FOR INSERT WITH CHECK (
  get_user_role(organization_id) = 'admin'
);
CREATE POLICY "dept_update_admin" ON departments FOR UPDATE USING (
  get_user_role(organization_id) = 'admin'
);
CREATE POLICY "dept_delete_admin" ON departments FOR DELETE USING (
  get_user_role(organization_id) = 'admin'
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ORG_MEMBERS — membros veem colegas; admin gerencia      ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "members_select" ON org_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM org_members om WHERE om.organization_id = org_members.organization_id AND om.user_email = auth_email())
);
CREATE POLICY "members_insert_admin" ON org_members FOR INSERT WITH CHECK (
  get_user_role(organization_id) = 'admin'
);
CREATE POLICY "members_update_admin" ON org_members FOR UPDATE USING (
  get_user_role(organization_id) = 'admin'
);
CREATE POLICY "members_delete_admin" ON org_members FOR DELETE USING (
  get_user_role(organization_id) = 'admin'
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  TICKETS — isolamento por departamento                   ║
-- ║  Admin/Supervisor: todos os depts da org                 ║
-- ║  Agent: apenas o próprio dept                            ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "tickets_select" ON tickets FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "tickets_insert" ON tickets FOR INSERT WITH CHECK (
  user_in_department(department_id) OR is_org_admin_of_dept(department_id)
);
CREATE POLICY "tickets_update" ON tickets FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "tickets_delete" ON tickets FOR DELETE USING (
  is_org_admin_of_dept(department_id)
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  COMMENTS — segue o mesmo isolamento dos tickets         ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "comments_select" ON comments FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (
  is_org_admin_of_dept(department_id)
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ATTACHMENTS — segue o mesmo isolamento dos tickets      ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "attachments_select" ON attachments FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "attachments_insert" ON attachments FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "attachments_delete" ON attachments FOR DELETE USING (
  is_org_admin_of_dept(department_id)
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ACTIVITY_LOG — leitura por dept; inserção livre          ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "activity_log_select" ON activity_log FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  BOARD_COLUMNS — por departamento                        ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "board_columns_select" ON board_columns FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "board_columns_insert" ON board_columns FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "board_columns_update" ON board_columns FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "board_columns_delete" ON board_columns FOR DELETE USING (
  is_org_admin_of_dept(department_id)
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  BOARD_LABELS — por departamento                         ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "board_labels_select" ON board_labels FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "board_labels_insert" ON board_labels FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "board_labels_update" ON board_labels FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "board_labels_delete" ON board_labels FOR DELETE USING (
  is_org_admin_of_dept(department_id)
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  NOTIFICATIONS — apenas o destinatário vê                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (
  recipient_email = auth_email()
);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (
  recipient_email = auth_email()
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ANNOUNCEMENTS — leitura por dept; CRUD por supervisor+  ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "announcements_insert" ON announcements FOR INSERT WITH CHECK (
  has_permission('announcements:manage')
);
CREATE POLICY "announcements_update" ON announcements FOR UPDATE USING (
  has_permission('announcements:manage')
);
CREATE POLICY "announcements_delete" ON announcements FOR DELETE USING (
  has_permission('announcements:manage')
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  USEFUL_LINKS — leitura por dept; CRUD por agent+        ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "useful_links_select" ON useful_links FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "useful_links_insert" ON useful_links FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "useful_links_update" ON useful_links FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "useful_links_delete" ON useful_links FOR DELETE USING (
  department_id IN (SELECT visible_department_ids())
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  USER_PROFILES — membros da mesma org podem ver          ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.organization_id = user_profiles.organization_id
      AND om.user_email = auth_email()
  )
);
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT WITH CHECK (
  email = auth_email()
);
CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE USING (
  email = auth_email() OR has_permission('members:change_role')
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  PLANNER (pessoal) — só o próprio usuário                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "planner_events_select" ON planner_events FOR SELECT USING (
  user_email = auth_email()
);
CREATE POLICY "planner_events_insert" ON planner_events FOR INSERT WITH CHECK (
  user_email = auth_email()
);
CREATE POLICY "planner_events_update" ON planner_events FOR UPDATE USING (
  user_email = auth_email()
);
CREATE POLICY "planner_events_delete" ON planner_events FOR DELETE USING (
  user_email = auth_email()
);

CREATE POLICY "planner_settings_select" ON planner_notification_settings FOR SELECT USING (
  user_email = auth_email()
);
CREATE POLICY "planner_settings_upsert" ON planner_notification_settings FOR INSERT WITH CHECK (
  user_email = auth_email()
);
CREATE POLICY "planner_settings_update" ON planner_notification_settings FOR UPDATE USING (
  user_email = auth_email()
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ROLE_PERMISSIONS — leitura pública (tabela de lookup)   ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT USING (true);
