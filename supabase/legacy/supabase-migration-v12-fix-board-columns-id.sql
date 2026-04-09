-- Migration V12: Corrigir board_columns para usar TEXT como ID
-- Os IDs devem corresponder aos valores de tickets.status (backlog, in_progress, etc.)

-- 1. Apagar dados existentes (UUIDs gerados incorretamente)
DELETE FROM board_columns;

-- 2. Alterar tipo do ID de UUID para TEXT
ALTER TABLE board_columns ALTER COLUMN id SET DATA TYPE TEXT;

-- 3. Alterar o default (remover gen_random_uuid)
ALTER TABLE board_columns ALTER COLUMN id DROP DEFAULT;

-- 4. Inserir colunas com IDs que correspondem ao tickets.status
INSERT INTO board_columns (id, title, position, dot_color, is_archived) VALUES
  ('backlog',      'Backlog',          0, '#579dff', false),
  ('in_progress',  'Em Progresso',     1, '#579dff', false),
  ('waiting_devs', 'Aguardando Devs',  2, '#f5a623', false),
  ('resolved',     'Resolvido',        3, '#4bce97', false);

-- Confirmar
SELECT id, title, position, dot_color FROM board_columns ORDER BY position;
