-- =============================================================
-- Migration V3: Activity Log
-- Run this SQL in your Supabase SQL Editor
-- =============================================================

-- 1. Activity log table
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tickets(id) on delete cascade,
  user_name text not null default 'Sistema',
  action_text text not null,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "Authenticated can read activity_log"
  on public.activity_log for select to authenticated using (true);

create policy "Authenticated can insert activity_log"
  on public.activity_log for insert to authenticated with check (true);

-- 2. Enable Realtime
alter publication supabase_realtime add table public.activity_log;
