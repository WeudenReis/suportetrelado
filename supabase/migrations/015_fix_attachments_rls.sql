-- ============================================================
-- Migration 015: Flexibilizar RLS de Storage e tabela attachments
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- Motivo: Tickets legados sem department_id bloqueavam uploads
--   - Storage: prefixo 'shared/' exigia is_super_admin() → bloqueava todos
--   - Tabela:  INSERT/SELECT exigia dept IN (...) → rejeitava dept NULL
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  1. STORAGE — relaxar prefixo 'shared/' para authenticated  ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Upload
DROP POLICY IF EXISTS "attachments_dept_upload" ON storage.objects;
CREATE POLICY "attachments_dept_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (
    -- Caminho normal: primeiro segmento é um UUID de departamento visível
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    -- Caminho legado: prefixo 'shared/' permitido a qualquer autenticado
    -- (o controle de quem pode subir em 'shared' fica no aplicativo)
    OR split_part(name, '/', 1) = 'shared'
  )
);

-- Read
DROP POLICY IF EXISTS "attachments_dept_read" ON storage.objects;
CREATE POLICY "attachments_dept_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR split_part(name, '/', 1) = 'shared'
  )
);

-- Delete
DROP POLICY IF EXISTS "attachments_dept_delete" ON storage.objects;
CREATE POLICY "attachments_dept_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR split_part(name, '/', 1) = 'shared'
  )
);

-- Update
DROP POLICY IF EXISTS "attachments_dept_update" ON storage.objects;
CREATE POLICY "attachments_dept_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    storage_path_dept_id(name) IN (SELECT visible_department_ids())
    OR split_part(name, '/', 1) = 'shared'
  )
);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2. TABELA attachments — admitir department_id IS NULL      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Remover policies originais (004_rls_policies)
DROP POLICY IF EXISTS "attachments_select" ON attachments;
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "attachments_update" ON attachments;
DROP POLICY IF EXISTS "attachments_delete" ON attachments;

-- SELECT: dept visível OU legado (dept NULL)
CREATE POLICY "attachments_select" ON attachments FOR SELECT USING (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

-- INSERT: dept visível OU legado (dept NULL)
CREATE POLICY "attachments_insert" ON attachments FOR INSERT WITH CHECK (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

-- UPDATE: mesma regra que SELECT
CREATE POLICY "attachments_update" ON attachments FOR UPDATE USING (
  department_id IN (SELECT visible_department_ids())
  OR department_id IS NULL
);

-- DELETE: admin do dept OU legado (dept NULL — qualquer autenticado pode limpar)
CREATE POLICY "attachments_delete" ON attachments FOR DELETE USING (
  is_org_admin_of_dept(department_id)
  OR department_id IS NULL
);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  NOTAS                                                       ║
-- ║                                                             ║
-- ║  - 'shared/' agora é acessível a qualquer authenticated.    ║
-- ║    A política de negócios (quem pode subir lá) é controlada ║
-- ║    pelo frontend: o fallback inteligente já prefere o       ║
-- ║    departamento ativo do usuário e só cai em 'shared/'      ║
-- ║    quando não há nenhum departamento disponível.            ║
-- ║                                                             ║
-- ║  - Tickets legados (department_id IS NULL) ficam visíveis   ║
-- ║    a todos os autenticados — mesma lógica que o frontend    ║
-- ║    já aplicava antes da migration 011.                      ║
-- ╚══════════════════════════════════════════════════════════════╝
