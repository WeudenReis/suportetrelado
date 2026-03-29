-- =============================================================
-- Fix: Backfill user_profiles from auth.users
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This inserts all existing auth.users that are NOT yet in user_profiles.
-- SAFE to run multiple times (idempotent).
-- =============================================================

-- Passo 1: Verificar usuários no auth (descomente para testar)
-- SELECT id, email, raw_user_meta_data, created_at, last_sign_in_at
-- FROM auth.users ORDER BY created_at;

-- Passo 2: Verificar se user_profiles está vazia (descomente para testar)
-- SELECT COUNT(*) FROM user_profiles;

-- Passo 3: Inserir todos os usuários existentes
INSERT INTO user_profiles (email, name, avatar_color, role, last_seen_at, created_at)
SELECT
  u.email,

  -- Nome: pega do metadata ou usa prefixo do email
  COALESCE(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'display_name',
    split_part(u.email, '@', 1)
  ) AS name,

  -- Cor única por usuário (8 cores rotativas, mesmas do código)
  (ARRAY[
    '#579dff', '#4bce97', '#f5a623', '#ef5c48',
    '#a259ff', '#20c997', '#6366f1', '#ec4899'
  ])[(abs(hashtext(u.email)) % 8) + 1] AS avatar_color,

  'member' AS role,

  -- Último acesso: usar last_sign_in_at se disponível
  COALESCE(u.last_sign_in_at, u.created_at) AS last_seen_at,

  u.created_at

FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.email = u.email
);

-- Passo 4: Confirmar inserção
SELECT id, name, email, avatar_color, role, last_seen_at, created_at
FROM user_profiles
ORDER BY last_seen_at DESC;
