-- =============================================================
-- Migration V7: Ensure ALL columns exist on 'tickets' table
-- Fixes: "Could not find the 'X' column of 'tickets' in the schema cache"
--
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This is SAFE to run multiple times (idempotent).
-- =============================================================

-- Columns from original schema
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS assignee TEXT DEFAULT NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Columns from migration v4
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS cliente TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS instancia TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS link_retaguarda TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS link_sessao TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS observacao TEXT DEFAULT '';

-- Columns used by the app but missing from previous migrations
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS due_date TEXT DEFAULT NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT NULL;

-- Reload PostgREST schema cache so columns are visible immediately
NOTIFY pgrst, 'reload schema';
