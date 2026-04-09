-- =============================================================
-- FIX: Normalizar campo 'assignee' — converter nomes para emails
-- Isso corrige a duplicação de usuários (email + nome separados)
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- SAFE to run multiple times (idempotent).
-- =============================================================

-- Atualizar assignees que são nomes para seus respectivos emails
-- Para cada user_profile, substituir o nome pelo email no campo assignee
DO $$
DECLARE
  prof RECORD;
BEGIN
  FOR prof IN SELECT email, name FROM public.user_profiles WHERE name IS NOT NULL AND name != '' LOOP
    -- Substituir nome exato (case-insensitive) pelo email
    -- Cuidado com vírgulas: trata assignees com múltiplos valores
    
    -- Caso 1: assignee é exatamente o nome (sem vírgula)
    UPDATE public.tickets
    SET assignee = prof.email, updated_at = NOW()
    WHERE lower(trim(assignee)) = lower(prof.name)
      AND assignee NOT LIKE '%,%';
    
    -- Caso 2: assignee começa com o nome seguido de vírgula
    UPDATE public.tickets
    SET assignee = prof.email || substring(assignee from length(prof.name) + 1),
        updated_at = NOW()
    WHERE lower(trim(split_part(assignee, ',', 1))) = lower(prof.name)
      AND assignee LIKE '%,%';
      
    -- Caso 3: nome aparece no meio ou final (após vírgula)
    UPDATE public.tickets
    SET assignee = replace(assignee, prof.name, prof.email),
        updated_at = NOW()
    WHERE assignee LIKE '%' || prof.name || '%'
      AND assignee NOT LIKE '%' || prof.email || '%';
      
  END LOOP;
END $$;

-- Verificação: listar assignees que ainda podem ter nomes
-- (descomentar para debugar)
-- SELECT DISTINCT unnest(string_to_array(assignee, ',')) AS assignee_value
-- FROM public.tickets
-- WHERE assignee IS NOT NULL
-- ORDER BY assignee_value;
