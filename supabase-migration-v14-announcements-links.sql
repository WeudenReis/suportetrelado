-- Migration: Avisos do Supervisor + Links Úteis
-- Rodar no Supabase SQL Editor (ambos ambientes)

-- ══════════════════════════════════════════════
-- 1. Tabela de Avisos do Supervisor
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  author TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (true);
CREATE POLICY "announcements_insert" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "announcements_update" ON announcements FOR UPDATE USING (true);
CREATE POLICY "announcements_delete" ON announcements FOR DELETE USING (true);

-- ══════════════════════════════════════════════
-- 2. Tabela de Links Úteis
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS useful_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'geral',
  icon TEXT DEFAULT 'link',
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE useful_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "useful_links_select" ON useful_links FOR SELECT USING (true);
CREATE POLICY "useful_links_insert" ON useful_links FOR INSERT WITH CHECK (true);
CREATE POLICY "useful_links_update" ON useful_links FOR UPDATE USING (true);
CREATE POLICY "useful_links_delete" ON useful_links FOR DELETE USING (true);
