-- Migration 024: settings por departamento (JSONB)
--
-- Cada departamento pode personalizar terminologia, visibilidade de campos
-- especificos do suporte (cliente, instancia, link_retaguarda, link_sessao)
-- e modulos auxiliares (announcements, links). Permite escalonar o app para
-- outros departamentos (Comercial, Financeiro, etc.) sem fork de codigo.
--
-- Estrutura esperada do JSON (shape default aplicado no frontend):
--   {
--     "terminology": { "ticket_singular": "Chamado", "ticket_plural": "Chamados" },
--     "fields": {
--       "cliente":          { "visible": true,  "label": "Cliente",     "required": false },
--       "instancia":        { "visible": true,  "label": "Instancia",   "required": false },
--       "link_retaguarda":  { "visible": true,  "label": "Link Retaguarda" },
--       "link_sessao":      { "visible": true,  "label": "Link Sessao" },
--       "observacao":       { "visible": true,  "label": "Observacoes" }
--     },
--     "modules": { "announcements": true, "links": true }
--   }
--
-- Manter compat: coluna com default '{}' preserva comportamento atual
-- (frontend aplica defaults onde chave faltar).
--
-- Execucao: Supabase SQL Editor (rodar inteiro). Idempotente.

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS departments_settings_is_object;

ALTER TABLE departments
  ADD CONSTRAINT departments_settings_is_object
  CHECK (jsonb_typeof(settings) = 'object');

NOTIFY pgrst, 'reload schema';
