-- ============================================================
-- Migration 029: Blocos personalizaveis do Dashboard (por usuario)
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  1) Tabela user_dashboard_blocks                         ║
-- ║                                                          ║
-- ║  Cada usuario monta seu painel customizado escolhendo    ║
-- ║  tipo de grafico (barras/pizza/linhas) e dimensao        ║
-- ║  (lista, etiqueta, responsavel, prioridade, vencimento). ║
-- ║  Os blocos sao escopados por (user_email, department_id) ║
-- ║  para que cada departamento tenha seu painel proprio.    ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.user_dashboard_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL REFERENCES public.user_profiles(email) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL CHECK (chart_type IN ('bar', 'pie', 'line')),
  dimension TEXT NOT NULL CHECK (dimension IN ('column', 'tag', 'assignee', 'priority', 'due_date')),
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_blocks_owner
  ON public.user_dashboard_blocks(user_email, department_id, position);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  2) Trigger updated_at                                   ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.user_dashboard_blocks_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_dashboard_blocks_updated_at ON public.user_dashboard_blocks;
CREATE TRIGGER user_dashboard_blocks_updated_at
  BEFORE UPDATE ON public.user_dashboard_blocks
  FOR EACH ROW EXECUTE FUNCTION public.user_dashboard_blocks_set_updated_at();

-- ╔══════════════════════════════════════════════════════════╗
-- ║  3) Row Level Security                                   ║
-- ║  Cada usuario so ve/edita os proprios blocos.            ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE public.user_dashboard_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_dashboard_blocks_select_own" ON public.user_dashboard_blocks;
DROP POLICY IF EXISTS "user_dashboard_blocks_insert_own" ON public.user_dashboard_blocks;
DROP POLICY IF EXISTS "user_dashboard_blocks_update_own" ON public.user_dashboard_blocks;
DROP POLICY IF EXISTS "user_dashboard_blocks_delete_own" ON public.user_dashboard_blocks;

CREATE POLICY "user_dashboard_blocks_select_own"
  ON public.user_dashboard_blocks FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

CREATE POLICY "user_dashboard_blocks_insert_own"
  ON public.user_dashboard_blocks FOR INSERT
  TO authenticated
  WITH CHECK (user_email = auth.email());

CREATE POLICY "user_dashboard_blocks_update_own"
  ON public.user_dashboard_blocks FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY "user_dashboard_blocks_delete_own"
  ON public.user_dashboard_blocks FOR DELETE
  TO authenticated
  USING (user_email = auth.email());

-- Reload do schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  NOTAS                                                   ║
-- ║                                                          ║
-- ║  - chart_type: 'bar' | 'pie' | 'line'                    ║
-- ║  - dimension: 'column' | 'tag' | 'assignee'              ║
-- ║                | 'priority' | 'due_date'                 ║
-- ║  - position controla a ordem dos blocos no grid.         ║
-- ║  - department_id NULL = bloco "global" do usuario        ║
-- ║    (visivel em todos os departamentos).                  ║
-- ╚══════════════════════════════════════════════════════════╝
