-- ============================================================
-- Migration 023: Corrigir RLS de avisos + sincronizar role_permissions
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- Depende de: 003_rbac_helpers.sql, 008_fix_links_rls.sql
-- ============================================================
-- Contexto:
-- A migration 008, ao consertar um cenario legado de avisos com
-- department_id NULL, dropou as policies INSERT/UPDATE/DELETE de
-- announcements e recriou sem a verificacao has_permission(
-- 'announcements:manage') que existia na migration 004. Resultado:
-- qualquer usuario do departamento (incluindo agent) conseguia
-- criar/editar/apagar avisos via API direta, ignorando a matriz
-- RBAC. Esta migration restaura o gate de permissao.
--
-- Alem disso, sincroniza role_permissions com a matriz aprovada:
--  - admin: adiciona tickets:edit_details
--  - supervisor: adiciona tickets:edit_details, settings:manage
--                remove tickets:delete
--  - agent: sem alteracao
-- ============================================================

-- ── 1. Restaurar gate de permissao em announcements ──
DROP POLICY IF EXISTS "announcements_insert" ON announcements;
DROP POLICY IF EXISTS "announcements_update" ON announcements;
DROP POLICY IF EXISTS "announcements_delete" ON announcements;

CREATE POLICY "announcements_insert" ON announcements FOR INSERT WITH CHECK (
  (department_id IS NULL OR department_id IN (SELECT visible_department_ids()))
  AND has_permission('announcements:manage')
);

CREATE POLICY "announcements_update" ON announcements FOR UPDATE USING (
  (department_id IS NULL OR department_id IN (SELECT visible_department_ids()))
  AND has_permission('announcements:manage')
);

CREATE POLICY "announcements_delete" ON announcements FOR DELETE USING (
  (department_id IS NULL OR department_id IN (SELECT visible_department_ids()))
  AND has_permission('announcements:manage')
);
-- SELECT continua aberto para todos do departamento (anuncio e visivel)

-- ── 2. Sincronizar role_permissions com a matriz aprovada ──
-- Admin ganha tickets:edit_details
INSERT INTO role_permissions (role, permission) VALUES
  ('admin', 'tickets:edit_details')
ON CONFLICT (role, permission) DO NOTHING;

-- Supervisor ganha tickets:edit_details e settings:manage
INSERT INTO role_permissions (role, permission) VALUES
  ('supervisor', 'tickets:edit_details'),
  ('supervisor', 'settings:manage')
ON CONFLICT (role, permission) DO NOTHING;

-- Supervisor perde tickets:delete (so admin pode deletar)
DELETE FROM role_permissions
WHERE role = 'supervisor' AND permission = 'tickets:delete';

NOTIFY pgrst, 'reload schema';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  VALIDACAO POS-MIGRATION                                   ║
-- ║                                                            ║
-- ║  -- Contagem por role (esperado: admin=16, sup=11, agent=5)║
-- ║  SELECT role, count(*) FROM role_permissions               ║
-- ║    GROUP BY role ORDER BY role;                            ║
-- ║                                                            ║
-- ║  -- Confirmar que supervisor NAO tem tickets:delete:       ║
-- ║  SELECT * FROM role_permissions                            ║
-- ║    WHERE role = 'supervisor' AND permission = 'tickets:delete';║
-- ║  -- deve retornar 0 rows                                    ║
-- ╚══════════════════════════════════════════════════════════╝
