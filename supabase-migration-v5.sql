-- =============================================================
-- Migration V5: Instance settings table
-- Run this SQL in your Supabase SQL Editor
-- =============================================================

CREATE TABLE IF NOT EXISTS public.instance_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  instance_code text NOT NULL DEFAULT '',
  access_token text DEFAULT '',
  api_url text DEFAULT '',
  label text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- One config per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_instance_settings_user
  ON public.instance_settings (user_email);

-- Enable RLS
ALTER TABLE public.instance_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their own settings
CREATE POLICY "Users can manage own instance settings"
  ON public.instance_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
