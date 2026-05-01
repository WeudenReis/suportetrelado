-- ============================================================
-- Migration 012: Storage policies escopadas por departamento
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- Depende de: 006_storage_policies.sql
-- Motivo: O bucket 'attachments' permitia leitura/escrita livre
-- para qualquer authenticated. Agora exigimos que o primeiro
-- segmento do path seja um department_id visivel pelo usuario.
-- Layout do path: {department_id}/{ticket_id}/{nome_arquivo}
-- 'shared/' e aceito apenas para super admins (uploads legados).
-- ============================================================

-- ── Helper: verifica se o usuario logado e super admin ──
-- Mantem em sincronia com src/lib/superAdmins.ts (fonte unica no frontend).
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT lower(coalesce(auth_email(), '')) IN (
    'weudenfilho@gmail.com',
    'wandersonthegod@gmail.com'
  );
$$;

-- ── Helper: extrair UUID do primeiro segmento do path ──
CREATE OR REPLACE FUNCTION storage_path_dept_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  seg text;
BEGIN
  seg := split_part(object_name, '/', 1);
  IF seg ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN seg::uuid;
  END IF;
  RETURN NULL;
END;
$$;

-- ── Remover policies abertas da migration 006 ──
DROP POLICY IF EXISTS "attachments_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "attachments_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "attachments_authenticated_delete" ON storage.objects;

-- ── Upload: dept_id do path deve estar visivel pelo usuario ──
CREATE POLICY "attachments_dept_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR (split_part(name, '/', 1) = 'shared' AND is_super_admin())
  )
);

-- ── Read: mesma regra ──
CREATE POLICY "attachments_dept_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR (split_part(name, '/', 1) = 'shared' AND is_super_admin())
  )
);

-- ── Delete: mesma regra ──
CREATE POLICY "attachments_dept_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR (split_part(name, '/', 1) = 'shared' AND is_super_admin())
  )
);

-- ── Update (para overwrite/copy raros): mesma regra ──
DROP POLICY IF EXISTS "attachments_dept_update" ON storage.objects;
CREATE POLICY "attachments_dept_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR (split_part(name, '/', 1) = 'shared' AND is_super_admin())
  )
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  NOTAS                                                    ║
-- ║                                                           ║
-- ║  - Frontend DEVE prefixar o path com {department_id}/    ║
-- ║    antes de fazer upload (ja aplicado em uploadAttachment ║
-- ║    e CardDetailModal cover upload).                       ║
-- ║  - Uploads legados no prefixo 'shared/' continuam         ║
-- ║    acessiveis SOMENTE para super admins. Se precisar      ║
-- ║    migrar, faca um script que move shared/{tid}/... para  ║
-- ║    {dept}/{tid}/... e atualize attachments.storage_path.  ║
-- ╚══════════════════════════════════════════════════════════╝
