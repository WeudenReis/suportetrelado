-- ============================================================
-- Migration 003: RBAC — Funções helper para verificação de permissões
-- Execução: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- IMPORTANTE: Executar DEPOIS da migration 001
-- ============================================================

-- ── 1. Função: retorna o email do usuário autenticado ──
CREATE OR REPLACE FUNCTION auth_email()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::json->>'email', ''),
    nullif(current_setting('request.jwt.claims', true)::json->'user_metadata'->>'email', '')
  );
$$;

-- ── 2. Função: retorna o role do usuário em uma organização ──
CREATE OR REPLACE FUNCTION get_user_role(org_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM org_members
  WHERE organization_id = org_id AND user_email = auth_email()
  LIMIT 1;
$$;

-- ── 3. Função: verifica se o usuário pertence a um departamento ──
CREATE OR REPLACE FUNCTION user_in_department(dept_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE department_id = dept_id AND user_email = auth_email()
  );
$$;

-- ── 4. Função: verifica se é admin da org de um departamento ──
CREATE OR REPLACE FUNCTION is_org_admin_of_dept(dept_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members om
    JOIN departments d ON d.id = dept_id
    WHERE om.organization_id = d.organization_id
      AND om.user_email = auth_email()
      AND om.role = 'admin'
  );
$$;

-- ── 5. Função: retorna os department_ids que o usuário pode ver ──
--    Admin/Supervisor veem TODOS os depts da org
--    Agent vê apenas o próprio dept
CREATE OR REPLACE FUNCTION visible_department_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT d.id
  FROM departments d
  JOIN org_members om ON om.organization_id = d.organization_id
  WHERE om.user_email = auth_email()
    AND (
      om.role IN ('admin', 'supervisor')    -- admin/supervisor: todos os depts da org
      OR om.department_id = d.id            -- agent: apenas o próprio dept
    );
$$;

-- ── 6. View materializada: permissões do usuário logado ──
--    Útil para o frontend consultar rapidamente
CREATE OR REPLACE VIEW my_permissions AS
SELECT
  om.organization_id,
  om.department_id,
  om.role,
  o.name AS organization_name,
  o.slug AS organization_slug,
  d.name AS department_name,
  d.slug AS department_slug
FROM org_members om
JOIN organizations o ON o.id = om.organization_id
LEFT JOIN departments d ON d.id = om.department_id
WHERE om.user_email = auth_email();

-- ── 7. Tabela de permissões por role (para referência e queries) ──
CREATE TABLE IF NOT EXISTS role_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text NOT NULL CHECK (role IN ('admin', 'supervisor', 'agent')),
  permission text NOT NULL,
  UNIQUE (role, permission)
);

-- Seed de permissões padrão
INSERT INTO role_permissions (role, permission) VALUES
  -- Admin: tudo
  ('admin', 'tickets:create'),
  ('admin', 'tickets:read'),
  ('admin', 'tickets:update'),
  ('admin', 'tickets:delete'),
  ('admin', 'tickets:archive'),
  ('admin', 'tickets:assign'),
  ('admin', 'columns:manage'),
  ('admin', 'labels:manage'),
  ('admin', 'members:invite'),
  ('admin', 'members:remove'),
  ('admin', 'members:change_role'),
  ('admin', 'departments:manage'),
  ('admin', 'announcements:manage'),
  ('admin', 'links:manage'),
  ('admin', 'settings:manage'),
  -- Supervisor: quase tudo, sem gerenciar membros/departamentos
  ('supervisor', 'tickets:create'),
  ('supervisor', 'tickets:read'),
  ('supervisor', 'tickets:update'),
  ('supervisor', 'tickets:delete'),
  ('supervisor', 'tickets:archive'),
  ('supervisor', 'tickets:assign'),
  ('supervisor', 'columns:manage'),
  ('supervisor', 'labels:manage'),
  ('supervisor', 'announcements:manage'),
  ('supervisor', 'links:manage'),
  -- Agent: operações básicas
  ('agent', 'tickets:create'),
  ('agent', 'tickets:read'),
  ('agent', 'tickets:update'),
  ('agent', 'tickets:archive'),
  ('agent', 'links:manage')
ON CONFLICT (role, permission) DO NOTHING;

-- ── 8. Função: verifica se o usuário tem permissão específica ──
CREATE OR REPLACE FUNCTION has_permission(perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_members om
    JOIN role_permissions rp ON rp.role = om.role
    WHERE om.user_email = auth_email()
      AND rp.permission = perm
  );
$$;
