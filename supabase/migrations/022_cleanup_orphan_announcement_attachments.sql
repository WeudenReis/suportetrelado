-- ============================================================
-- Migration 022: RPC para identificar anexos orfaos de avisos
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- Depende de: 012_storage_dept_scoped.sql, 021_announcements_attachments.sql
-- Motivo: Se um usuario faz upload de um anexo ao compor um aviso
-- e fecha o modal ANTES de publicar (ou o browser crasha), o arquivo
-- fica no bucket sem referencia na tabela announcements.
-- Esta RPC retorna a lista de paths orfaos. Um script externo
-- (scripts/cleanup-orphan-attachments.mjs) chama a API de Storage
-- para removelos fisicamente.
-- ============================================================

CREATE OR REPLACE FUNCTION list_orphan_announcement_attachments(
  older_than_hours int DEFAULT 24
)
RETURNS TABLE(storage_path text, size_bytes bigint, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH referenced AS (
    SELECT DISTINCT (jsonb_array_elements(attachments) ->> 'storage_path')::text AS path
    FROM public.announcements
    WHERE jsonb_array_length(attachments) > 0
  )
  SELECT
    o.name AS storage_path,
    COALESCE((o.metadata ->> 'size')::bigint, 0) AS size_bytes,
    o.created_at
  FROM storage.objects o
  WHERE o.bucket_id = 'attachments'
    AND o.name LIKE '%/announcements/%'
    AND o.created_at < now() - make_interval(hours => older_than_hours)
    AND NOT EXISTS (SELECT 1 FROM referenced r WHERE r.path = o.name)
  ORDER BY o.created_at ASC;
$$;

-- Apenas service_role pode invocar (contem informacoes de storage cross-dept)
REVOKE ALL ON FUNCTION list_orphan_announcement_attachments(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION list_orphan_announcement_attachments(int) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  COMO USAR                                                ║
-- ║                                                           ║
-- ║  1. Rodar esta migration no SQL Editor do Supabase        ║
-- ║  2. Rodar `node scripts/cleanup-orphan-attachments.mjs`   ║
-- ║     (requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)     ║
-- ║                                                           ║
-- ║  O script pode ser agendado via GitHub Actions            ║
-- ║  (.github/workflows/cleanup-orphans.yml) para rodar       ║
-- ║  diariamente.                                             ║
-- ╚══════════════════════════════════════════════════════════╝
