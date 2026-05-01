-- Migration 017: adiciona coluna storage_path na tabela attachments
-- Corrige erro "Could not find the 'storage_path' column in the schema cache"
-- Execucao: Supabase SQL Editor (rodar inteiro).

ALTER TABLE attachments ADD COLUMN IF NOT EXISTS storage_path text;

NOTIFY pgrst, 'reload schema';
