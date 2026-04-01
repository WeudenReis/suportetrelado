-- Migration: Trigger para atualizar updated_at automaticamente em board_labels
-- Rodar nos dois ambientes (dev e prod)

CREATE OR REPLACE FUNCTION set_board_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_board_labels_updated_at ON board_labels;
CREATE TRIGGER trg_board_labels_updated_at
BEFORE UPDATE ON board_labels
FOR EACH ROW
EXECUTE FUNCTION set_board_labels_updated_at();
