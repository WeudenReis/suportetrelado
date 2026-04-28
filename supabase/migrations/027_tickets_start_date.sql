-- ============================================================
-- Migration 027: start_date em tickets (Timeline / Gantt)
-- Motivo: a Timeline View precisa de uma data de inicio para
-- desenhar a barra temporal entre start_date e due_date. Sem
-- start_date, o cartao usa um fallback (created_at), mas com
-- start_date explicito ficamos compativeis com agendamento real.
-- Idempotente: pode rodar varias vezes.
-- ============================================================

-- 1. Coluna start_date como date (ja temos due_date como date,
--    mantemos consistencia). NULL ate o usuario definir.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS start_date date;

-- 2. Indice parcial para acelerar consultas da Timeline
--    (somente cartoes com start_date definido).
CREATE INDEX IF NOT EXISTS idx_tickets_start_date
  ON public.tickets(start_date)
  WHERE start_date IS NOT NULL;

-- 3. Indice composto start_date+due_date para joins/ordenacao
--    em ranges temporais (Timeline carrega "tickets que se
--    sobrepoem ao range visivel").
CREATE INDEX IF NOT EXISTS idx_tickets_start_due
  ON public.tickets(start_date, due_date)
  WHERE start_date IS NOT NULL OR due_date IS NOT NULL;

-- 4. Constraint coerente: se ambos preenchidos, start <= due.
--    Permitimos NULL em qualquer um (ainda em rascunho).
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tickets_start_before_due'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_start_before_due
      CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date);
  END IF;
END
$check$;

-- 5. Reload do PostgREST para que o schema cache reconheca a coluna
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Validacao final (opcional, rode apos a migration):
--   SELECT column_name, data_type
--     FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='tickets'
--       AND column_name IN ('start_date','due_date');
--   -- Esperado: 2 linhas, ambas data_type='date'.
-- ============================================================
