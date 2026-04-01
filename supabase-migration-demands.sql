-- Supabase schema for demands (Coach Profile)
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Create demands table
CREATE TABLE IF NOT EXISTS public.demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pendente' CHECK(status in ('pendente', 'em_andamento', 'concluido')),
  coach_email text,
  requester_email text NOT NULL,
  activity_type text NOT NULL CHECK(activity_type in ('training', '1:1', 'operational_support', 'studying', 'dashboard_creation', 'other')),
  time_spent_minutes integer DEFAULT 0,
  is_self_assigned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demands"
  ON public.demands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert demands"
  ON public.demands FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update demands"
  ON public.demands FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete demands"
  ON public.demands FOR DELETE
  TO authenticated
  USING (true);

-- 3. Auto-update updated_at trigger
CREATE TRIGGER set_updated_at_demands
  BEFORE UPDATE ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.demands;
