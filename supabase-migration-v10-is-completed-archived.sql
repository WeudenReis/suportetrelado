-- Migration V10: Adiciona colunas is_completed e is_archived na tabela tickets
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Confirmação
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tickets'
AND column_name IN ('is_completed', 'is_archived');
