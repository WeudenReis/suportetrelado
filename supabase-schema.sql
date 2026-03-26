-- Supabase schema for tickets

create table if not exists public.tickets (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  client_instance text not null,
  priority text not null check(priority in ('Low', 'Medium', 'High', 'Critical')),
  links jsonb,
  diagnosis text,
  evidence_storage_url text,
  assigned_to text,
  status text not null default 'Backlog' check(status in ('Backlog', 'In Progress', 'Waiting for Devs', 'Resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Realtime is enabled by default for public schema and table in Supabase settings.
