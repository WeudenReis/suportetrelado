-- ============================================================
-- Migration 025: Security Hardening (resposta ao pentest)
-- Execucao: Supabase SQL Editor (rodar INTEIRO de uma vez)
-- Motivo: Fechar vetores explorados no pentest (JWT interceptado
--         + bypass do RBAC do frontend via PostgREST direto).
-- Estrategia: FORCE RLS + WITH CHECK + has_permission() em escritas
--             + triggers para campos sensiveis + search_path fixo
--             + revoke de GRANTs em anon.
-- Idempotente: pode rodar varias vezes sem efeito colateral.
-- ============================================================


-- ── 0. Garantir RLS habilitado e FORCADO em todas as tabelas publicas ──
DO $migration$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.relname);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', r.relname);
  END LOOP;
END
$migration$;


-- ── 1. Fixar search_path em SECURITY DEFINER (anti CVE-2018-1058) ──
-- Cada ALTER tem IF EXISTS implicito via DO block para nao falhar
-- caso alguma funcao nao exista no projeto.
DO $migration$
DECLARE
  fname text;
  fnames text[] := ARRAY[
    'auth_email()',
    'get_user_role()',
    'has_permission(text)',
    'user_belongs_to_org(uuid)',
    'user_org_ids()',
    'visible_department_ids()',
    'is_org_admin_of_dept(uuid)',
    'user_in_department(uuid)',
    'handle_new_user()'
  ];
BEGIN
  FOREACH fname IN ARRAY fnames LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%s SET search_path = public, pg_temp;', fname);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Funcao public.% nao existe, pulando', fname;
    END;
  END LOOP;
END
$migration$;


-- ── 2. WITH CHECK em UPDATE + has_permission() nas tabelas com department_id ──
-- TICKETS
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated
  USING      (department_id IN (SELECT visible_department_ids()) AND has_permission('tickets:update'))
  WITH CHECK (department_id IN (SELECT visible_department_ids()) AND has_permission('tickets:update'));

DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (department_id IN (SELECT visible_department_ids()) AND has_permission('tickets:create'));

DROP POLICY IF EXISTS "tickets_delete" ON public.tickets;
CREATE POLICY "tickets_delete" ON public.tickets FOR DELETE TO authenticated
  USING (department_id IN (SELECT visible_department_ids()) AND has_permission('tickets:delete'));


-- BOARD_COLUMNS
DROP POLICY IF EXISTS "board_columns_update" ON public.board_columns;
CREATE POLICY "board_columns_update" ON public.board_columns FOR UPDATE TO authenticated
  USING      (department_id IN (SELECT visible_department_ids()) AND has_permission('columns:manage'))
  WITH CHECK (department_id IN (SELECT visible_department_ids()) AND has_permission('columns:manage'));


-- BOARD_LABELS
DROP POLICY IF EXISTS "board_labels_update" ON public.board_labels;
CREATE POLICY "board_labels_update" ON public.board_labels FOR UPDATE TO authenticated
  USING      (department_id IN (SELECT visible_department_ids()) AND has_permission('labels:manage'))
  WITH CHECK (department_id IN (SELECT visible_department_ids()) AND has_permission('labels:manage'));


-- USEFUL_LINKS
DROP POLICY IF EXISTS "useful_links_update" ON public.useful_links;
CREATE POLICY "useful_links_update" ON public.useful_links FOR UPDATE TO authenticated
  USING      (department_id IN (SELECT visible_department_ids()) AND has_permission('links:manage'))
  WITH CHECK (department_id IN (SELECT visible_department_ids()) AND has_permission('links:manage'));


-- AUTO_RULES
DROP POLICY IF EXISTS "auto_rules_update" ON public.auto_rules;
CREATE POLICY "auto_rules_update" ON public.auto_rules FOR UPDATE TO authenticated
  USING      (department_id IN (SELECT visible_department_ids()) AND has_permission('settings:manage'))
  WITH CHECK (department_id IN (SELECT visible_department_ids()) AND has_permission('settings:manage'));


-- TICKET_TEMPLATES
DROP POLICY IF EXISTS "ticket_templates_update" ON public.ticket_templates;
CREATE POLICY "ticket_templates_update" ON public.ticket_templates FOR UPDATE TO authenticated
  USING      (department_id IN (SELECT visible_department_ids()) AND has_permission('settings:manage'))
  WITH CHECK (department_id IN (SELECT visible_department_ids()) AND has_permission('settings:manage'));


-- DEPARTMENTS
DROP POLICY IF EXISTS "departments_update" ON public.departments;
CREATE POLICY "departments_update" ON public.departments FOR UPDATE TO authenticated
  USING      (id IN (SELECT visible_department_ids()) AND has_permission('departments:manage'))
  WITH CHECK (id IN (SELECT visible_department_ids()) AND has_permission('departments:manage'));


-- ORGANIZATIONS
DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations FOR UPDATE TO authenticated
  USING      (id IN (SELECT user_org_ids()) AND has_permission('settings:manage'))
  WITH CHECK (id IN (SELECT user_org_ids()) AND has_permission('settings:manage'));


-- ── 3. Trigger BEFORE UPDATE em tickets (permissoes de campo) ──
-- Usa colunas reais: assignee (text), department_id (uuid).
-- NAO checa column_id porque tickets usa coluna "status" (text), nao FK para board_columns.
CREATE OR REPLACE FUNCTION public.check_ticket_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  -- Bloquear reatribuicao se nao tem tickets:assign
  IF NEW.assignee IS DISTINCT FROM OLD.assignee
     AND NOT has_permission('tickets:assign') THEN
    RAISE EXCEPTION 'Sem permissao para atribuir tickets (tickets:assign)' USING ERRCODE = '42501';
  END IF;

  -- Bloquear mudanca de department_id se nao for admin do dept destino
  IF NEW.department_id IS DISTINCT FROM OLD.department_id
     AND NOT is_org_admin_of_dept(NEW.department_id) THEN
    RAISE EXCEPTION 'Apenas admin pode mover ticket entre departamentos' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS trg_check_ticket_update_permissions ON public.tickets;
CREATE TRIGGER trg_check_ticket_update_permissions
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.check_ticket_update_permissions();


-- ── 4. Hardening de org_members (evitar auto-promocao) ──
DROP POLICY IF EXISTS "org_members_insert" ON public.org_members;
CREATE POLICY "org_members_insert" ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT user_org_ids())
    AND has_permission('members:invite')
    AND role IN ('admin','supervisor','agent')
  );

DROP POLICY IF EXISTS "org_members_update" ON public.org_members;
CREATE POLICY "org_members_update" ON public.org_members FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT user_org_ids()) AND has_permission('members:change_role'))
  WITH CHECK (organization_id IN (SELECT user_org_ids())
              AND has_permission('members:change_role')
              AND role IN ('admin','supervisor','agent'));

-- Imutabilidade de organization_id e user_email apos criacao
CREATE OR REPLACE FUNCTION public.guard_org_members_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id e imutavel em org_members' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_email IS DISTINCT FROM OLD.user_email THEN
    RAISE EXCEPTION 'user_email e imutavel em org_members' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS trg_guard_org_members_update ON public.org_members;
CREATE TRIGGER trg_guard_org_members_update
  BEFORE UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_org_members_update();


-- ── 5. user_profiles: restringir SELECT ao mesmo tenant ──
-- Sem isso, qualquer authenticated le emails de todas as orgs.
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select" ON public.user_profiles FOR SELECT TO authenticated
  USING (
    email = auth_email()
    OR email IN (
      SELECT om2.user_email
      FROM org_members om1
      JOIN org_members om2 ON om2.organization_id = om1.organization_id
      WHERE om1.user_email = auth_email()
    )
  );


-- ── 6. notifications: confinar ao department visivel + recipient = self ──
-- Schema real: department_id, recipient_email, sender_name (nao tem organization_id nem sender_email).
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (department_id IN (SELECT visible_department_ids()));

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING      (recipient_email = auth_email())
  WITH CHECK (recipient_email = auth_email());


-- ── 7. comments: confinar ao ticket de departamento visivel ──
-- Schema real: department_id, ticket_id, user_name (nao tem user_email).
-- Policies sao pelo dept e pelo ownership do ticket; quem e o autor e validado no app.
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    department_id IN (SELECT visible_department_ids())
    AND ticket_id IN (
      SELECT id FROM tickets WHERE department_id IN (SELECT visible_department_ids())
    )
  );

DROP POLICY IF EXISTS "comments_update" ON public.comments;
CREATE POLICY "comments_update" ON public.comments FOR UPDATE TO authenticated
  USING      (department_id IN (SELECT visible_department_ids()) AND has_permission('tickets:update'))
  WITH CHECK (department_id IN (SELECT visible_department_ids()) AND has_permission('tickets:update'));

DROP POLICY IF EXISTS "comments_delete" ON public.comments;
CREATE POLICY "comments_delete" ON public.comments FOR DELETE TO authenticated
  USING (department_id IN (SELECT visible_department_ids()) AND has_permission('tickets:update'));


-- ── 8. activity_log: insert restrito ao dept visivel ──
-- Schema real: department_id, card_id, user_name (nao tem organization_id nem user_email).
DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;
CREATE POLICY "activity_log_insert" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (department_id IN (SELECT visible_department_ids()));


-- ── 9. role_permissions: somente leitura para authenticated ──
-- Sem policy de INSERT/UPDATE/DELETE = sem acesso. SELECT continua valido pela policy existente.
DROP POLICY IF EXISTS "role_permissions_insert" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_update" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_delete" ON public.role_permissions;


-- ── 10. REVOKE de GRANTs em anon (defesa em profundidade) ──
DO $migration$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon;', r.relname);
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon;', r.relname);
  END LOOP;
END
$migration$;


-- ── 11. Reload do PostgREST ──
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- Verificacao pos-aplicacao (rode separadamente apos esta migration):
--
--   -- Deve retornar 0
--   SELECT count(*) FROM pg_policies
--   WHERE schemaname='public' AND cmd='UPDATE' AND with_check IS NULL;
--
--   -- Deve retornar 0
--   SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND c.relkind='r' AND c.relforcerowsecurity = false;
--
--   -- SECURITY DEFINER funcs com search_path setado
--   SELECT proname, proconfig FROM pg_proc p
--   JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.prosecdef=true;
-- ============================================================
