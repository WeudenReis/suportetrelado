-- Migration 016: attachments DELETE aceita department_id IS NULL
-- Fecha lacuna da migration 015 (que cobriu SELECT/INSERT/UPDATE, mas nao DELETE).
-- Execucao: Supabase SQL Editor (rodar inteiro).

DROP POLICY IF EXISTS "attachments_delete" ON attachments;

CREATE POLICY "attachments_delete" ON attachments
FOR DELETE USING (
  is_org_admin_of_dept(department_id)
  OR department_id IS NULL
);
