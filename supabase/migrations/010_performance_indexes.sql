-- ============================================================
-- Migration 010: Indices otimizados para paginacao e filtragem
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- Depende de: 002 (department_id) e 005 (indices base)
-- ============================================================

-- Paginacao principal do Kanban: filtra por dept + nao arquivados e ordena por created_at DESC.
-- Substitui seek-scans quando ha muitos tickets arquivados no mesmo departamento.
CREATE INDEX IF NOT EXISTS idx_tickets_dept_active_created
  ON tickets(department_id, created_at DESC)
  WHERE is_archived = false;

-- Lista de arquivados (ArchivedPanel): por dept + updated_at DESC
CREATE INDEX IF NOT EXISTS idx_tickets_dept_archived_updated
  ON tickets(department_id, updated_at DESC)
  WHERE is_archived = true;

-- auto_rules: filtro de leitura sempre por dept + enabled = true
CREATE INDEX IF NOT EXISTS idx_auto_rules_dept_enabled
  ON auto_rules(department_id)
  WHERE enabled = true;

-- activity_log: timeline de um card ordenada por data
CREATE INDEX IF NOT EXISTS idx_activity_log_card_created
  ON activity_log(card_id, created_at DESC);

-- comments: timeline de comentarios por ticket
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created
  ON comments(ticket_id, created_at ASC);
