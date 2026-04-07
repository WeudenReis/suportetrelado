-- Fix: Garantir que o bucket 'attachments' seja público no ambiente DEV
-- Isso permite que getPublicUrl funcione sem autenticação.
-- Executar no SQL Editor do Supabase DEV (vbxzeyweurzrwppdiluo)

-- 1. Garantir que o bucket existe e é público
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Garantir policy de SELECT público (anon + authenticated)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_public_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_public_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'attachments');
  END IF;
END $$;

-- Verificar resultado
SELECT id, name, public FROM storage.buckets WHERE id = 'attachments';
