-- Migration 015: Liberar prefixo shared/ + aceitar dept NULL em attachments
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)

-- ----------------------------------------------------------------
-- PARTE 1 — STORAGE: adicionar policies dedicadas ao prefixo shared/
-- As policies de departamento da migration 012 ficam intactas.
-- Permissive: o Supabase aplica OR entre todas as policies ativas.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "attachments_shared_upload" ON storage.objects;
DROP POLICY IF EXISTS "attachments_shared_read" ON storage.objects;
DROP POLICY IF EXISTS "attachments_shared_delete" ON storage.objects;
DROP POLICY IF EXISTS "attachments_shared_update" ON storage.objects;

CREATE POLICY "attachments_shared_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND split_part(name, '/', 1) = 'shared'
);

CREATE POLICY "attachments_shared_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND split_part(name, '/', 1) = 'shared'
);

CREATE POLICY "attachments_shared_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND split_part(name, '/', 1) = 'shared'
);

CREATE POLICY "attachments_shared_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND split_part(name, '/', 1) = 'shared'
);

-- ----------------------------------------------------------------
-- PARTE 2 — TABELA attachments: aceitar department_id IS NULL
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "attachments_select" ON attachments;
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "attachments_update" ON attachments;
DROP POLICY IF EXISTS "attachments_delete" ON attachments;

CREATE POLICY "attachments_select" ON attachments
FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

CREATE POLICY "attachments_insert" ON attachments
FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

CREATE POLICY "attachments_update" ON attachments
FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

CREATE POLICY "attachments_delete" ON attachments
FOR DELETE USING (
  is_org_admin_of_dept(department_id)
  OR department_id IS NULL
);
