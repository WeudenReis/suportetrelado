-- Migration V6: Ensure 'assignee' column exists on 'tickets' table
-- Fixes: "Could not find the 'assignee' column of 'tickets' in the schema cache"

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'tickets'
      AND column_name  = 'assignee'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN assignee TEXT DEFAULT NULL;
  END IF;
END $$;

-- Reload PostgREST schema cache so the column is visible immediately
NOTIFY pgrst, 'reload schema';
