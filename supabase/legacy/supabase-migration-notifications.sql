-- =============================================================
-- MIGRATION: Tabela de notificações para Inbox + menções @
-- Cole no SQL Editor do Supabase (DEV e PROD)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'mention',  -- 'mention', 'assignment', 'move', 'comment'
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  ticket_title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications (recipient_email, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

NOTIFY pgrst, 'reload schema';
