-- ============================================================
-- Migration 026: Correcoes do Hardening (complementa a 025)
-- Motivo: Validacao apos 025 mostrou 3 itens nao cobertos:
--   1. 7 SECURITY DEFINER funcs sem search_path (ALTER FUNCTION
--      falhou na 025 por assinatura errada de get_user_role)
--   2. 6 UPDATE policies sem WITH CHECK (tabelas fora do escopo
--      original da 025)
--   3. Grants residuais para anon (REVOKE dentro de DO nao
--      persistiu)
-- Idempotente: pode rodar varias vezes.
-- ============================================================


-- ── 1. Fixar search_path nas SECURITY DEFINER (assinaturas reais) ──
ALTER FUNCTION public.auth_email()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_role(uuid)           SET search_path = public, pg_temp;
ALTER FUNCTION public.has_permission(text)          SET search_path = public, pg_temp;
ALTER FUNCTION public.user_belongs_to_org(uuid)     SET search_path = public, pg_temp;
ALTER FUNCTION public.user_org_ids()                SET search_path = public, pg_temp;
ALTER FUNCTION public.visible_department_ids()      SET search_path = public, pg_temp;
ALTER FUNCTION public.is_org_admin_of_dept(uuid)    SET search_path = public, pg_temp;
ALTER FUNCTION public.user_in_department(uuid)      SET search_path = public, pg_temp;


-- ── 2. Adicionar WITH CHECK nas 6 UPDATE policies pendentes ──
-- Recria cada uma copiando o USING para WITH CHECK (politicas equivalentes
-- ao comportamento atual, mas agora bloqueando vazamento cross-tenant em UPDATE).

-- 2a. announcements_update
DO $fix$
DECLARE v_qual text;
BEGIN
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname='public' AND tablename='announcements' AND policyname='announcements_update';
  IF v_qual IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "announcements_update" ON public.announcements';
    EXECUTE format('CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_qual, v_qual);
  END IF;
END
$fix$;

-- 2b. org_update_admin (organizations)
DO $fix$
DECLARE v_qual text;
BEGIN
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname='public' AND tablename='organizations' AND policyname='org_update_admin';
  IF v_qual IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "org_update_admin" ON public.organizations';
    EXECUTE format('CREATE POLICY "org_update_admin" ON public.organizations FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_qual, v_qual);
  END IF;
END
$fix$;

-- 2c. dept_update_admin (departments)
DO $fix$
DECLARE v_qual text;
BEGIN
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname='public' AND tablename='departments' AND policyname='dept_update_admin';
  IF v_qual IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "dept_update_admin" ON public.departments';
    EXECUTE format('CREATE POLICY "dept_update_admin" ON public.departments FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_qual, v_qual);
  END IF;
END
$fix$;

-- 2d. planner_settings_update (planner_notification_settings)
DO $fix$
DECLARE v_qual text;
BEGIN
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname='public' AND tablename='planner_notification_settings' AND policyname='planner_settings_update';
  IF v_qual IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "planner_settings_update" ON public.planner_notification_settings';
    EXECUTE format('CREATE POLICY "planner_settings_update" ON public.planner_notification_settings FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_qual, v_qual);
  END IF;
END
$fix$;

-- 2e. notifications_update (recriar — a 025 nao pegou)
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING      (recipient_email = auth_email())
  WITH CHECK (recipient_email = auth_email());

-- 2f. planner_events_update
DO $fix$
DECLARE v_qual text;
BEGIN
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname='public' AND tablename='planner_events' AND policyname='planner_events_update';
  IF v_qual IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "planner_events_update" ON public.planner_events';
    EXECUTE format('CREATE POLICY "planner_events_update" ON public.planner_events FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_qual, v_qual);
  END IF;
END
$fix$;


-- ── 3. REVOKE explicito de grants para anon ──
-- Default privileges para evitar que NOVAS tabelas concedam para anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- REVOKE explicito tabela-a-tabela das tabelas e views existentes
-- (relkind='r' tabela, 'v' view, 'm' matview, 'p' partitioned, 'f' foreign)
DO $revoke$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p','f')
  LOOP
    EXECUTE 'REVOKE ALL ON public.' || quote_ident(r.relname) || ' FROM anon';
  END LOOP;
END
$revoke$;


-- ── 4. Reload do PostgREST ──
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- Validacao final (rode separadamente apos esta migration):
--
-- Todos devem retornar 0:
--   SELECT count(*) FROM pg_policies WHERE schemaname='public' AND cmd='UPDATE' AND with_check IS NULL;
--   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--     WHERE n.nspname='public' AND p.prosecdef=true
--     AND (p.proconfig IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'));
--   SELECT count(*) FROM information_schema.role_table_grants
--     WHERE table_schema='public' AND grantee='anon';
-- ============================================================
