-- Migration V11: Criar tabela board_columns para listas personalizáveis

CREATE TABLE IF NOT EXISTS board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  dot_color TEXT NOT NULL DEFAULT '#579dff',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (todos os usuários autenticados podem ler/escrever)
CREATE POLICY "board_columns_select" ON board_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_columns_insert" ON board_columns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "board_columns_update" ON board_columns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "board_columns_delete" ON board_columns FOR DELETE TO authenticated USING (true);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE board_columns;

-- Inserir colunas padrão
INSERT INTO board_columns (id, title, position, dot_color, is_archived) VALUES
  (gen_random_uuid(), 'Backlog',          0, '#579dff', false),
  (gen_random_uuid(), 'Em Progresso',     1, '#579dff', false),
  (gen_random_uuid(), 'Aguardando Devs',  2, '#f5a623', false),
  (gen_random_uuid(), 'Resolvido',        3, '#4bce97', false);

-- Confirmar
SELECT id, title, position, dot_color FROM board_columns ORDER BY position;
