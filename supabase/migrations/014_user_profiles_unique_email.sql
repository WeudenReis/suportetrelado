-- ============================================================
-- Migration 014: Adiciona constraint UNIQUE em user_profiles.email
-- Necessário para que .upsert(payload, { onConflict: 'email' })
-- funcione sem HTTP 400 — PostgREST exige índice único para ON CONFLICT.
-- Execução: Supabase SQL Editor (projetos dev E produção)
-- IMPORTANTE: Executar DEPOIS da migration 013
-- ============================================================

-- Idempotente: só adiciona se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_email_key'
      AND conrelid = 'user_profiles'::regclass
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_email_key UNIQUE (email);
  END IF;
END;
$$;
