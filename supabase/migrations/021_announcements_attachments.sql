-- Migration 021: anexos embutidos em announcements (JSONB)
--
-- Avisos têm um número pequeno e fixo de anexos por publicação, são lidos
-- sempre junto com o aviso (lista no Mural) e nunca são consultados em
-- separado. JSONB embutido evita N+1 / join e mantém o realtime atômico
-- (INSERT/UPDATE de announcements já carrega os anexos no payload).
--
-- Estrutura de cada elemento do array:
--   { name, url, storage_path, type, mime, size }
--   - type: 'image' | 'video' | 'file'
--   - storage_path: usado pelo frontend para renovar signed URL (1h TTL
--     padrão do Supabase) e para deletar o objeto no Storage.
--
-- Storage: reutiliza o bucket 'attachments' existente. Path padronizado
-- como `{department_id}/announcements/{timestamp}-{rand}/{nome}` — herda
-- automaticamente as policies escopadas por dept da migration 012.
--
-- Execução: Supabase SQL Editor (rodar inteiro). Idempotente.

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Garantia de tipo: array no topo (sanity-check para escritas malformadas).
ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_attachments_is_array;

ALTER TABLE announcements
  ADD CONSTRAINT announcements_attachments_is_array
  CHECK (jsonb_typeof(attachments) = 'array');

NOTIFY pgrst, 'reload schema';
