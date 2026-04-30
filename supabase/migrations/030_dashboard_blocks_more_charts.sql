-- ============================================================
-- Migration 030: Permite os tipos hbar/donut/funnel em
--                user_dashboard_blocks.chart_type
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  Atualiza a constraint CHECK para aceitar os 3 novos     ║
-- ║  tipos de grafico:                                       ║
-- ║    - hbar   (barras horizontais)                         ║
-- ║    - donut  (pizza vazada com total no centro)           ║
-- ║    - funnel (funil para visualizar pipeline)             ║
-- ║                                                          ║
-- ║  Idempotente: o DROP usa IF EXISTS e o ADD pode ser      ║
-- ║  executado em estados que ja contem a constraint nova.   ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE public.user_dashboard_blocks
  DROP CONSTRAINT IF EXISTS user_dashboard_blocks_chart_type_check;

ALTER TABLE public.user_dashboard_blocks
  ADD CONSTRAINT user_dashboard_blocks_chart_type_check
  CHECK (chart_type IN ('bar', 'pie', 'line', 'hbar', 'donut', 'funnel'));

-- Reload do schema do PostgREST
NOTIFY pgrst, 'reload schema';
