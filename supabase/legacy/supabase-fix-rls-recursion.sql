-- Fix: Resolver "infinite recursion in policy" e garantir que user_profiles e org_members funcionem
-- Executar no SQL Editor do Supabase DEV (vbxzeyweurzrwppdiluo)

-- ═══ 1. LIMPAR TODAS AS POLICIES PROBLEMÁTICAS ═══

-- user_profiles: remover todas e recriar simples
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
  END LOOP;
END $$;

-- org_members: remover todas e recriar simples
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'org_members' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.org_members', pol.policyname);
  END LOOP;
END $$;

-- ═══ 2. RECRIAR POLICIES SIMPLES (SEM RECURSÃO) ═══

-- user_profiles: qualquer autenticado pode ler/inserir/atualizar
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.user_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- org_members: qualquer autenticado pode ler/inserir/atualizar/deletar
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select" ON public.org_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_members_insert" ON public.org_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "org_members_update" ON public.org_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "org_members_delete" ON public.org_members FOR DELETE TO authenticated USING (true);

-- ═══ 3. GARANTIR BUCKET PÚBLICO ═══
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ═══ 4. VERIFICAR ═══
SELECT tablename, policyname, cmd, qual FROM pg_policies
WHERE tablename IN ('user_profiles', 'org_members') AND schemaname = 'public'
ORDER BY tablename, policyname;

SELECT id, name, public FROM storage.buckets WHERE id = 'attachments';
