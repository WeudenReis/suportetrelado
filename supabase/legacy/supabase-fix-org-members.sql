-- ============================================================
-- FIX: Inserir admins na tabela org_members
-- 
-- PROBLEMA: As migrations 001-005 criaram organizations,
-- departments e políticas RLS, mas NÃO inseriram nenhum
-- usuário na tabela org_members. Como todas as policies
-- verificam org_members para decidir acesso, NINGUÉM
-- consegue ver nada → tela branca.
--
-- SOLUÇÃO: Inserir os admins como membros da org.
--
-- Rodar no SQL Editor do Supabase DEV:
-- https://supabase.com/dashboard/project/vbxzeyweurzrwppdiluo/sql
-- ============================================================

-- 1. Garantir que a org e o dept existem
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'chatPro', 'chatpro')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO departments (id, organization_id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Suporte Geral',
  'suporte-geral'
)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- 2. Inserir os admins na org_members
INSERT INTO org_members (organization_id, department_id, user_email, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'weudenfilho@gmail.com', 'admin'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'michaelshiryu@hotmail.com', 'admin')
ON CONFLICT (organization_id, user_email) DO UPDATE
SET role = 'admin',
    department_id = '00000000-0000-0000-0000-000000000010';

-- 3. Garantir que user_profiles também tem organization_id
UPDATE user_profiles
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE email IN ('weudenfilho@gmail.com', 'michaelshiryu@hotmail.com')
  AND (organization_id IS NULL OR organization_id != '00000000-0000-0000-0000-000000000001');

-- 4. Verificação — deve retornar 2 linhas
SELECT om.user_email, om.role, o.name AS org, d.name AS dept
FROM org_members om
JOIN organizations o ON o.id = om.organization_id
LEFT JOIN departments d ON d.id = om.department_id
ORDER BY om.user_email;
