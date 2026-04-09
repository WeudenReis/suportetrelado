-- =============================================================
-- Migration V4: New ticket fields (cliente, instancia, links)
-- Run this SQL in your Supabase SQL Editor
-- =============================================================

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS cliente text DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS instancia text DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS link_retaguarda text DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS link_sessao text DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS observacao text DEFAULT '';
