-- Migration 015: Flexibilizar RLS de Storage e tabela attachments
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- Motivo: prefixo shared/ exigia is_super_admin(); tabela rejeitava dept NULL

-- ----------------------------------------------------------------
-- 1. STORAGE: relaxar prefixo shared/ para qualquer autenticado
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "attachments_dept_upload" ON storage.objects;
CREATE POLICY "attachments_dept_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR split_part(name, '/', 1) = 'shared'
  )
);

DROP POLICY IF EXISTS "attachments_dept_read" ON storage.objects;
CREATE POLICY "attachments_dept_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR split_part(name, '/', 1) = 'shared'
  )
);

DROP POLICY IF EXISTS "attachments_dept_delete" ON storage.objects;
CREATE POLICY "attachments_dept_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR split_part(name, '/', 1) = 'shared'
  )
);

DROP POLICY IF EXISTS "attachments_dept_update" ON storage.objects;
CREATE POLICY "attachments_dept_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR split_part(name, '/', 1) = 'shared'
  )
);

-- ----------------------------------------------------------------
-- 2. TABELA attachments: admitir department_id IS NULL
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "attachments_select" ON attachments;
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "attachments_update" ON attachments;
DROP POLICY IF EXISTS "attachments_delete" ON attachments;

CREATE POLICY "attachments_select" ON attachments FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

CREATE POLICY "attachments_insert" ON attachments FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

CREATE POLICY "attachments_update" ON attachments FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

CREATE POLICY "attachments_delete" ON attachments FOR DELETE USING (
  is_org_admin_of_dept(department_id)
  OR department_id IS NULL
);
