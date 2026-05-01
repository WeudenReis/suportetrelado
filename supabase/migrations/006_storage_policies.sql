-- ============================================================
-- Migration 006: Storage Policies — URLs assinadas e isolamento
-- Execução: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- IMPORTANTE: Executar DEPOIS das migrations 001-004
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  REMOVER ACESSO PÚBLICO AO BUCKET DE ATTACHMENTS        ║
-- ║  (Agora usamos URLs assinadas em vez de URLs públicas)   ║
-- ╚══════════════════════════════════════════════════════════╝

-- Tornar o bucket privado (requer autenticação para acessar)
UPDATE storage.buckets
SET public = false
WHERE id = 'attachments';

-- ── Remover policies antigas se existirem ──
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "attachments_public_read" ON storage.objects;
DROP POLICY IF EXISTS "attachments_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "attachments_auth_delete" ON storage.objects;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  NOVAS POLICIES: apenas usuários autenticados            ║
-- ║  O isolamento por departamento é feito na tabela         ║
-- ║  attachments (RLS da migration 004), não no storage      ║
-- ╚══════════════════════════════════════════════════════════╝

-- Upload: qualquer usuário autenticado pode enviar para o bucket
CREATE POLICY "attachments_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Download: qualquer usuário autenticado pode ler (URL assinada já valida o auth)
CREATE POLICY "attachments_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

-- Delete: qualquer usuário autenticado pode remover seus uploads
CREATE POLICY "attachments_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments');

-- ╔══════════════════════════════════════════════════════════╗
-- ║  NOTAS PARA O FRONTEND                                   ║
-- ║                                                          ║
-- ║  Antes:  supabase.storage.getPublicUrl(path)             ║
-- ║  Depois: supabase.storage.createSignedUrl(path, 3600)    ║
-- ║                                                          ║
-- ║  As URLs assinadas expiram em 1h (3600s).                ║
-- ║  O frontend deve gerar novas URLs quando necessário.     ║
-- ╚══════════════════════════════════════════════════════════╝
