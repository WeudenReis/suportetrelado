-- ============================================================
-- Migration 005: Corrige recursão infinita nas políticas RLS
-- Execução: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- IMPORTANTE: Executar DEPOIS da migration 004
--
-- PROBLEMA: A policy "members_select" em org_members faz
-- SELECT FROM org_members dentro dela mesma → recursão infinita.
-- Policies em organizations, departments e user_profiles também
-- referenciam org_members diretamente, causando o mesmo erro.
--
-- SOLUÇÃO: Usar funções SECURITY DEFINER (que bypassam RLS)
-- para todas as verificações que precisam consultar org_members.
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  NOVA FUNÇÃO: retorna org_ids do usuário (SECURITY DEF)  ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM org_members WHERE user_email = auth_email();
$$;

CREATE OR REPLACE FUNCTION user_belongs_to_org(org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE organization_id = org_id AND user_email = auth_email()
  );
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  FIX: ORG_MEMBERS — remover policy recursiva             ║
-- ╚══════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "members_select" ON org_members;
CREATE POLICY "members_select" ON org_members FOR SELECT USING (
  organization_id IN (SELECT user_org_ids())
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  FIX: ORGANIZATIONS — usar função SECURITY DEFINER       ║
-- ╚══════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "org_select" ON organizations;
CREATE POLICY "org_select" ON organizations FOR SELECT USING (
  user_belongs_to_org(id)
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  FIX: DEPARTMENTS — usar função SECURITY DEFINER         ║
-- ╚══════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "dept_select" ON departments;
CREATE POLICY "dept_select" ON departments FOR SELECT USING (
  user_belongs_to_org(organization_id)
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  FIX: USER_PROFILES — remover referência direta a        ║
-- ║  org_members e manter compatibilidade com app existente   ║
-- ╚══════════════════════════════════════════════════════════╝

-- Remove TODAS as policies antigas de user_profiles para evitar conflito
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

-- Qualquer usuário autenticado pode ver perfis (necessário para login/checagem)
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT
  TO authenticated USING (true);

-- Usuário pode inserir/atualizar o próprio perfil
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (email = auth_email());

CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE
  TO authenticated USING (
    email = auth_email() OR has_permission('members:change_role')
  );

-- ╔══════════════════════════════════════════════════════════╗
-- ║  FIX: ROLE_PERMISSIONS — leitura livre para autenticados  ║
-- ╚══════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "role_permissions_select" ON role_permissions;
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT
  TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: Rode este SELECT após a migration para confirmar
-- SELECT * FROM user_profiles WHERE email = 'weudenfilho@gmail.com';
-- Deve retornar o registro sem erro.
-- ════════════════════════════════════════════════════════════
