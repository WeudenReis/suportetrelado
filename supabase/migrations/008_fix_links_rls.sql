-- Migration: Corrigir RLS de useful_links para linhas sem department_id
-- Linhas criadas antes da fase 3 (multi-tenancy) nao possuem department_id.
-- As policies bloqueavam silenciosamente SELECT/INSERT/UPDATE/DELETE nessas linhas.

-- Recriar policies para aceitar department_id NULL (legado) ou pertencente ao dept do usuario

DROP POLICY IF EXISTS "useful_links_select" ON useful_links;
DROP POLICY IF EXISTS "useful_links_insert" ON useful_links;
DROP POLICY IF EXISTS "useful_links_update" ON useful_links;
DROP POLICY IF EXISTS "useful_links_delete" ON useful_links;

CREATE POLICY "useful_links_select" ON useful_links FOR SELECT USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);

CREATE POLICY "useful_links_insert" ON useful_links FOR INSERT WITH CHECK (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);

CREATE POLICY "useful_links_update" ON useful_links FOR UPDATE USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);

CREATE POLICY "useful_links_delete" ON useful_links FOR DELETE USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);

-- Aplicar a mesma correção para announcements (mesmo cenário de legado)
DROP POLICY IF EXISTS "announcements_select" ON announcements;
DROP POLICY IF EXISTS "announcements_insert" ON announcements;
DROP POLICY IF EXISTS "announcements_update" ON announcements;
DROP POLICY IF EXISTS "announcements_delete" ON announcements;

CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);

CREATE POLICY "announcements_insert" ON announcements FOR INSERT WITH CHECK (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);

CREATE POLICY "announcements_update" ON announcements FOR UPDATE USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);

CREATE POLICY "announcements_delete" ON announcements FOR DELETE USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);
