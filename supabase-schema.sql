-- Supabase schema for tickets
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Create tickets table
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  priority text not null default 'medium' check(priority in ('low', 'medium', 'high')),
  status text not null default 'backlog' check(status in ('backlog', 'in_progress', 'waiting_devs', 'resolved')),
  assignee text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (allow all authenticated users to read/write)
alter table public.tickets enable row level security;

create policy "Authenticated users can read tickets"
  on public.tickets for select
  to authenticated
  using (true);

create policy "Authenticated users can insert tickets"
  on public.tickets for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update tickets"
  on public.tickets for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete tickets"
  on public.tickets for delete
  to authenticated
  using (true);

-- 3. Auto-update updated_at on row change
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.tickets
  for each row
  execute function public.handle_updated_at();

-- 4. Enable Realtime for the tickets table
alter publication supabase_realtime add table public.tickets;
