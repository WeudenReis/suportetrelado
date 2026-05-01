-- Migration: Full-text search com tsvector + GIN index
-- Adiciona coluna search_vector, trigger de atualização automática e RPC de busca

-- 1. Adicionar coluna tsvector
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Popular a coluna com dados existentes
UPDATE tickets SET search_vector =
  setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('portuguese', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(cliente, '')), 'C') ||
  setweight(to_tsvector('portuguese', coalesce(instancia, '')), 'C') ||
  setweight(to_tsvector('portuguese', coalesce(observacao, '')), 'D');

-- 3. Criar índice GIN para busca rápida
CREATE INDEX IF NOT EXISTS idx_tickets_search_vector ON tickets USING GIN (search_vector);

-- 4. Trigger para atualizar search_vector automaticamente
CREATE OR REPLACE FUNCTION tickets_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.cliente, '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.instancia, '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.observacao, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_search_vector ON tickets;
CREATE TRIGGER trg_tickets_search_vector
  BEFORE INSERT OR UPDATE OF title, description, cliente, instancia, observacao
  ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION tickets_search_vector_update();

-- 5. RPC para busca full-text com ranking
CREATE OR REPLACE FUNCTION search_tickets(
  search_query text,
  dept_id uuid DEFAULT NULL,
  max_results int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  department_id uuid,
  title text,
  description text,
  status text,
  priority text,
  assignee text,
  created_at timestamptz,
  updated_at timestamptz,
  tags text[],
  cliente text,
  instancia text,
  link_retaguarda text,
  link_sessao text,
  observacao text,
  due_date date,
  cover_image_url text,
  cover_thumb_url text,
  is_archived boolean,
  is_completed boolean,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id, t.department_id, t.title, t.description,
    t.status, t.priority, t.assignee,
    t.created_at, t.updated_at, t.tags,
    t.cliente, t.instancia, t.link_retaguarda, t.link_sessao,
    t.observacao, t.due_date, t.cover_image_url, t.cover_thumb_url,
    t.is_archived, t.is_completed,
    ts_rank(t.search_vector, plainto_tsquery('portuguese', search_query)) AS rank
  FROM tickets t
  WHERE
    t.search_vector @@ plainto_tsquery('portuguese', search_query)
    AND (dept_id IS NULL OR t.department_id = dept_id)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;
