-- ============================================================
-- Migration 011: Endurecimento de RLS
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- Motivo: Fechar brechas identificadas na auditoria da Fase 4
-- ============================================================

-- ── 1. auto_rules e ticket_templates: remover clausula "IS NULL" aberta ──
-- Antes: department_id IS NULL OR department_id IN (SELECT visible_department_ids())
-- Problema: registros orfaos (sem dept) ficavam visiveis a TODOS os authenticated users,
-- vazando entre organizacoes. Agora exigimos department_id ou que o usuario seja super admin.

DROP POLICY IF EXISTS "auto_rules_select" ON auto_rules;
DROP POLICY IF EXISTS "auto_rules_insert" ON auto_rules;
DROP POLICY IF EXISTS "auto_rules_update" ON auto_rules;
DROP POLICY IF EXISTS "auto_rules_delete" ON auto_rules;

CREATE POLICY "auto_rules_select" ON auto_rules FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "auto_rules_insert" ON auto_rules FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "auto_rules_update" ON auto_rules FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "auto_rules_delete" ON auto_rules FOR DELETE USING (
  department_id IN (SELECT visible_department_ids())
);

DROP POLICY IF EXISTS "ticket_templates_select" ON ticket_templates;
DROP POLICY IF EXISTS "ticket_templates_insert" ON ticket_templates;
DROP POLICY IF EXISTS "ticket_templates_update" ON ticket_templates;
DROP POLICY IF EXISTS "ticket_templates_delete" ON ticket_templates;

CREATE POLICY "ticket_templates_select" ON ticket_templates FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "ticket_templates_insert" ON ticket_templates FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "ticket_templates_update" ON ticket_templates FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "ticket_templates_delete" ON ticket_templates FOR DELETE USING (
  department_id IN (SELECT visible_department_ids())
);

-- ── 2. notifications: adicionar DELETE policy (destinatario pode deletar) ──
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (
  recipient_email = auth_email()
);
