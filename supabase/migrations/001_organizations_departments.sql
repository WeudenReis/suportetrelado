-- ============================================================
-- Migration 001: Organizations, Departments e Org Members
-- Execução: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- ============================================================

-- 1. Tabela de organizações (empresa/conta)
CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,          -- ex: "chatpro", usado em URLs
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabela de departamentos (dentro de uma organização)
CREATE TABLE IF NOT EXISTS departments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,              -- ex: "suporte-n1"
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

-- 3. Tabela de membros da organização (quem pertence a qual org/dept e com qual role)
CREATE TABLE IF NOT EXISTS org_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id   uuid REFERENCES departments(id) ON DELETE SET NULL,
  user_email      text NOT NULL,
  role            text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'supervisor', 'agent')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_email)
);

-- 4. Indexes
CREATE INDEX idx_departments_org ON departments(organization_id);
CREATE INDEX idx_org_members_org ON org_members(organization_id);
CREATE INDEX idx_org_members_dept ON org_members(department_id);
CREATE INDEX idx_org_members_email ON org_members(user_email);

-- 5. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_org_members_updated_at
  BEFORE UPDATE ON org_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Seed: criar organização e departamento padrão para migração suave
--    (AJUSTE o nome da organização conforme necessário)
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

-- 7. Migrar usuários existentes para org_members com role baseado no campo atual
INSERT INTO org_members (organization_id, department_id, user_email, role)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  up.email,
  CASE
    WHEN up.role = 'admin' THEN 'admin'
    WHEN up.role = 'supervisor' THEN 'supervisor'
    ELSE 'agent'
  END
FROM user_profiles up
ON CONFLICT (organization_id, user_email) DO NOTHING;
