-- =============================================================
-- Migration V8: User profiles — track all users who have logged in
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This is SAFE to run multiple times (idempotent).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  avatar_color  TEXT DEFAULT '#579dff',
  role          TEXT DEFAULT 'member',
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can view all profiles
CREATE POLICY "Authenticated users can view profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can insert/update profiles
CREATE POLICY "Authenticated users can insert profiles"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update profiles"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for user_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
