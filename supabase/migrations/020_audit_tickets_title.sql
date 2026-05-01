-- Migration 020: auditoria da coluna `title` em tickets
--
-- Espelho da migration 018 (auditoria de description) para o segundo
-- campo de conteúdo livre mais sensível em tickets. `title` e `description`
-- são os únicos dois campos onde uma escrita acidental causa perda de
-- dados não-recuperáveis (os demais — priority, status, assignee — são
-- valores de domínio limitado, fáceis de refazer manualmente).
--
-- Mesmo padrão da 018:
--   - tabela tickets_title_audit (forensic, sem RLS de SELECT)
--   - função SECURITY DEFINER para bypass de RLS no INSERT
--   - trigger BEFORE UPDATE OF title (column-level, baixo overhead)
--   - IS DISTINCT FROM dentro da função evita audit de no-op
--
-- Execução: Supabase SQL Editor (rodar inteiro). Idempotente.

-- ── Tabela de auditoria ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets_title_audit (
  id          bigserial PRIMARY KEY,
  ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  old_value   text,
  new_value   text,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  uuid
);

CREATE INDEX IF NOT EXISTS idx_tickets_title_audit_ticket_id
  ON tickets_title_audit (ticket_id);

CREATE INDEX IF NOT EXISTS idx_tickets_title_audit_changed_at
  ON tickets_title_audit (changed_at DESC);

-- ── Funcao do trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_tickets_title()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO tickets_title_audit (ticket_id, old_value, new_value, changed_by)
    VALUES (OLD.id, OLD.title, NEW.title, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_tickets_title ON tickets;
CREATE TRIGGER trg_audit_tickets_title
  BEFORE UPDATE OF title ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_tickets_title();

-- ── RLS ──────────────────────────────────────────────────────────────
-- Sem policies de SELECT: leitura apenas via service_role (SQL Editor).
-- O trigger insere via SECURITY DEFINER.
ALTER TABLE tickets_title_audit ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
