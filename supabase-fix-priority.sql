-- =============================================================
-- Fix: Priority check constraint mismatch
-- The app uses lowercase (low, medium, high) but the DB constraint
-- was created with Title Case (Low, Medium, High)
-- Run this SQL in your Supabase SQL Editor
-- =============================================================

-- 1. Update existing rows to lowercase
UPDATE public.tickets SET priority = lower(priority) WHERE priority != lower(priority);

-- 2. Drop the old check constraint
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_priority_check;

-- 3. Add the correct check constraint (lowercase)
ALTER TABLE public.tickets ADD CONSTRAINT tickets_priority_check
  CHECK (priority IN ('low', 'medium', 'high'));

-- 4. Set default to 'medium'
ALTER TABLE public.tickets ALTER COLUMN priority SET DEFAULT 'medium';
