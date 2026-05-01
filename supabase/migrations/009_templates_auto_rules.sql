-- Migration: Tabelas para templates de ticket e regras automaticas
-- Migra dados que antes ficavam apenas em localStorage

-- ── Templates de Ticket ──
CREATE TABLE IF NOT EXISTS ticket_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'backlog',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Regras Automaticas ──
CREATE TABLE IF NOT EXISTS auto_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'move_to',
  target_column TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_templates_dept ON ticket_templates(department_id);
CREATE INDEX IF NOT EXISTS idx_auto_rules_dept ON auto_rules(department_id);

-- RLS
ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_rules ENABLE ROW LEVEL SECURITY;

-- Policies — mesmos membros do departamento podem ler/escrever
CREATE POLICY "ticket_templates_select" ON ticket_templates FOR SELECT USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "ticket_templates_insert" ON ticket_templates FOR INSERT WITH CHECK (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "ticket_templates_update" ON ticket_templates FOR UPDATE USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "ticket_templates_delete" ON ticket_templates FOR DELETE USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);

CREATE POLICY "auto_rules_select" ON auto_rules FOR SELECT USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "auto_rules_insert" ON auto_rules FOR INSERT WITH CHECK (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "auto_rules_update" ON auto_rules FOR UPDATE USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);
CREATE POLICY "auto_rules_delete" ON auto_rules FOR DELETE USING (
  department_id IS NULL OR department_id IN (SELECT visible_department_ids())
);
