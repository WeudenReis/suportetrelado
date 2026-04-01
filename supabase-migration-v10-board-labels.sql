-- Migration: tabela de etiquetas reutilizáveis do board
-- Rodar nos dois ambientes (dev e prod)

CREATE TABLE IF NOT EXISTS board_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#579dff',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE board_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_labels_select" ON board_labels FOR SELECT USING (true);
CREATE POLICY "board_labels_insert" ON board_labels FOR INSERT WITH CHECK (true);
CREATE POLICY "board_labels_update" ON board_labels FOR UPDATE USING (true);
CREATE POLICY "board_labels_delete" ON board_labels FOR DELETE USING (true);
