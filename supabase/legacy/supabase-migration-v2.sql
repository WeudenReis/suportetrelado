-- =============================================================
-- Migration V2: Comments, Attachments & Storage
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- 1. Comments table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Authenticated can read comments"
  on public.comments for select to authenticated using (true);

create policy "Authenticated can insert comments"
  on public.comments for insert to authenticated with check (true);

create policy "Authenticated can delete comments"
  on public.comments for delete to authenticated using (true);

-- 2. Attachments table
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null default 'file',
  uploaded_by text,
  created_at timestamptz not null default now()
);

alter table public.attachments enable row level security;

create policy "Authenticated can read attachments"
  on public.attachments for select to authenticated using (true);

create policy "Authenticated can insert attachments"
  on public.attachments for insert to authenticated with check (true);

create policy "Authenticated can delete attachments"
  on public.attachments for delete to authenticated using (true);

-- 3. Enable Realtime for new tables
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.attachments;

-- 4. Create storage bucket for attachments (public read)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 5. Storage policies
create policy "Auth users can upload attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

create policy "Anyone can view attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

create policy "Auth users can delete attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');
