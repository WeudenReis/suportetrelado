-- ============================================================
-- Migration 028: Avatars de usuários (foto de perfil personalizada)
-- Execução: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  1) Coluna avatar_url em user_profiles                   ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Reload do schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  2) Bucket avatars (privado, leitura via URL assinada)   ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ── Remover policies antigas se existirem (idempotente) ──
DROP POLICY IF EXISTS "avatars_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  3) Policies — usuário só edita o próprio avatar         ║
-- ║  Convenção: caminho começa com `<user_id>/...`           ║
-- ║  storage.foldername(name)[1] retorna a primeira pasta.   ║
-- ╚══════════════════════════════════════════════════════════╝

-- Leitura: qualquer usuário autenticado pode ler avatares
CREATE POLICY "avatars_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Insert: apenas se o primeiro segmento do caminho == auth.uid()
CREATE POLICY "avatars_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Update: idem
CREATE POLICY "avatars_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete: idem
CREATE POLICY "avatars_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  NOTAS                                                   ║
-- ║                                                          ║
-- ║  - Frontend usa createSignedUrl(path, 3600) para ler     ║
-- ║  - Caminho de upload: `${auth.uid()}/avatar-<ts>.webp`   ║
-- ║  - avatar_url guarda apenas o PATH dentro do bucket      ║
-- ╚══════════════════════════════════════════════════════════╝
