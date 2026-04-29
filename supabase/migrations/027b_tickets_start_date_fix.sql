-- ============================================================
-- Migration 027b: start_date em tickets — versao compativel
-- Motivo: a 027 original assumiu due_date como `date`, mas em
-- producao due_date esta como `text`. Aqui adicionamos somente
-- start_date + indices, sem CHECK cross-column (validacao
-- "start <= due" fica no app, ja existente em src/lib).
-- Idempotente: pode rodar varias vezes.
-- ============================================================

-- 1. Coluna start_date como date
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS start_date date;

-- 2. Indice parcial para Timeline (apenas cards com start_date)
CREATE INDEX IF NOT EXISTS idx_tickets_start_date
  ON public.tickets(start_date)
  WHERE start_date IS NOT NULL;

-- 3. Indice composto start_date+due_date para ranges temporais
CREATE INDEX IF NOT EXISTS idx_tickets_start_due
  ON public.tickets(start_date, due_date)
  WHERE start_date IS NOT NULL OR due_date IS NOT NULL;

-- 4. Limpar a constraint quebrada caso ela tenha sido criada parcialmente
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_start_before_due;

-- 5. Reload do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Validacao final (rode apos a migration):
--
--   -- Coluna criada (esperado: 1 linha, data_type='date')
--   SELECT column_name, data_type
--     FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='tickets'
--       AND column_name = 'start_date';
--
--   -- Indices criados (esperado: 2 linhas)
--   SELECT indexname FROM pg_indexes
--     WHERE schemaname='public' AND tablename='tickets'
--       AND indexname IN ('idx_tickets_start_date','idx_tickets_start_due');
-- ============================================================
