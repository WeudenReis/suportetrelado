-- =============================================================
-- SETUP COMPLETO para Supabase DEV
-- Cole tudo no SQL Editor do projeto DEV e execute.
-- =============================================================

-- ═══ 1. TABELA TICKETS ═══
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'backlog',
  assignee TEXT DEFAULT NULL,
  tags TEXT[] DEFAULT '{}',
  cliente TEXT DEFAULT '',
  instancia TEXT DEFAULT '',
  link_retaguarda TEXT DEFAULT '',
  link_sessao TEXT DEFAULT '',
  observacao TEXT DEFAULT '',
  due_date TEXT DEFAULT NULL,
  cover_image_url TEXT DEFAULT NULL,
  is_completed BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tickets_delete" ON public.tickets FOR DELETE TO authenticated USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;

-- ═══ 2. TABELA COMMENTS ═══
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comments_delete" ON public.comments FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- ═══ 3. TABELA ATTACHMENTS ═══
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'file',
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_select" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "attachments_insert" ON public.attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attachments_delete" ON public.attachments FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments;

-- ═══ 4. STORAGE BUCKET ═══
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "storage_view" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY "storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments');

-- ═══ 5. TABELA ACTIVITY_LOG ═══
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT 'Sistema',
  action_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_select" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;

-- ═══ 6. TABELA INSTANCE_SETTINGS ═══
CREATE TABLE IF NOT EXISTS public.instance_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  instance_code TEXT NOT NULL DEFAULT '',
  access_token TEXT DEFAULT '',
  api_url TEXT DEFAULT '',
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instance_settings_user ON public.instance_settings (user_email);

ALTER TABLE public.instance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instance_settings_all" ON public.instance_settings FOR ALL USING (true) WITH CHECK (true);

-- ═══ 7. TABELA USER_PROFILES ═══
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_color TEXT DEFAULT '#579dff',
  role TEXT DEFAULT 'member',
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.user_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- ═══ 8. TABELA BOARD_COLUMNS ═══
CREATE TABLE IF NOT EXISTS public.board_columns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  dot_color TEXT NOT NULL DEFAULT '#579dff',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_columns_select" ON public.board_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_columns_insert" ON public.board_columns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "board_columns_update" ON public.board_columns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "board_columns_delete" ON public.board_columns FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.board_columns;

-- Inserir colunas padrão
INSERT INTO public.board_columns (id, title, position, dot_color, is_archived) VALUES
  ('backlog',      'Backlog',          0, '#579dff', false),
  ('in_progress',  'Em Progresso',     1, '#579dff', false),
  ('waiting_devs', 'Aguardando Devs',  2, '#f5a623', false),
  ('resolved',     'Resolvido',        3, '#4bce97', false)
ON CONFLICT (id) DO NOTHING;

-- ═══ 9. RELOAD SCHEMA CACHE ═══
NOTIFY pgrst, 'reload schema';
