-- Migration 018: auditoria da coluna `description` em tickets
--
-- Motivo: incidente em 22-23/04/2026 onde TicketUpdateSchema preservava
-- `.default('')` herdado via `.partial()`, zerando descricoes silenciosamente
-- em qualquer update parcial (drag de card, edicao de prioridade etc).
-- O bug foi corrigido em src/lib/schemas.ts. Esta migration garante que
-- futuros incidentes do mesmo tipo sejam recuperaveis em segundos via
-- UPDATE ... FROM tickets_description_audit.
--
-- Execucao: Supabase SQL Editor (rodar inteiro). Idempotente.

-- ── Tabela de auditoria ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets_description_audit (
  id          bigserial PRIMARY KEY,
  ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  old_value   text,
  new_value   text,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  uuid
);

CREATE INDEX IF NOT EXISTS idx_tickets_desc_audit_ticket_id
  ON tickets_description_audit (ticket_id);

CREATE INDEX IF NOT EXISTS idx_tickets_desc_audit_changed_at
  ON tickets_description_audit (changed_at DESC);

-- ── Funcao do trigger ────────────────────────────────────────────────
-- SECURITY DEFINER para que o INSERT na auditoria nao esbarre em RLS
-- nem em falta de permissao do role que disparou o update.
CREATE OR REPLACE FUNCTION fn_audit_tickets_description()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO tickets_description_audit (ticket_id, old_value, new_value, changed_by)
    VALUES (OLD.id, OLD.description, NEW.description, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger ──────────────────────────────────────────────────────────
-- BEFORE UPDATE OF description: so dispara quando a coluna esta no SET
-- list, evitando overhead em updates que nao tocam description.
-- A checagem IS DISTINCT FROM dentro da funcao evita audit de no-op
-- (mesmo valor sendo regravado).
DROP TRIGGER IF EXISTS trg_audit_tickets_description ON tickets;
CREATE TRIGGER trg_audit_tickets_description
  BEFORE UPDATE OF description ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_tickets_description();

-- ── RLS ──────────────────────────────────────────────────────────────
-- Tabela protegida sem policies de SELECT: leitura apenas via service_role
-- (SQL Editor do Supabase / backend). E forensic data — so DBA acessa.
-- O trigger consegue inserir porque roda com SECURITY DEFINER.
ALTER TABLE tickets_description_audit ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
