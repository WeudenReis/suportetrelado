-- ============================================================
-- Migration 013: Adiciona política DELETE em user_profiles
-- Permite que admins removam membros da plataforma
-- Execução: Supabase SQL Editor (projetos dev E produção)
-- IMPORTANTE: Executar DEPOIS de todas as migrations anteriores
-- ============================================================

-- Remover policy se existir (segurança para reexecução)
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;

-- Admins com permissão members:remove podem deletar perfis.
-- Usa members:remove (não members:change_role) pois semanticamente
-- é a permissão correta para exclusão de membros da plataforma.
CREATE POLICY "user_profiles_delete" ON user_profiles FOR DELETE
  TO authenticated USING (
    has_permission('members:remove')
  );
