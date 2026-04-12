import { supabase } from '../supabase'
import { logger } from '../logger'
import { TemplateInsertSchema, AutoRuleInsertSchema } from '../schemas'

export interface TicketTemplate {
  id: string
  name: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: string
}

export interface AutoRule {
  id: string
  name: string
  condition: string
  action: string
  target_column: string
  enabled: boolean
}

// ── Templates ────────────────────────────────────────────────

const TEMPLATES_STORAGE_KEY = 'chatpro-templates'
const RULES_STORAGE_KEY = 'chatpro-auto-rules'

function rulesCacheKey(departmentId?: string | null): string {
  return departmentId ? `${RULES_STORAGE_KEY}:${departmentId}` : RULES_STORAGE_KEY
}

function templatesCacheKey(departmentId?: string | null): string {
  return departmentId ? `${TEMPLATES_STORAGE_KEY}:${departmentId}` : TEMPLATES_STORAGE_KEY
}

function loadLocalTemplates(departmentId?: string | null): TicketTemplate[] {
  try {
    const raw = localStorage.getItem(templatesCacheKey(departmentId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLocalTemplates(templates: TicketTemplate[], departmentId?: string | null): void {
  localStorage.setItem(templatesCacheKey(departmentId), JSON.stringify(templates))
}

export async function fetchTemplates(user: string, departmentId?: string | null): Promise<TicketTemplate[]> {
  try {
    let query = supabase.from('ticket_templates').select('*').order('name', { ascending: true })
    if (departmentId) query = query.eq('department_id', departmentId)
    const { data, error } = await query
    if (error) throw error
    if (data && data.length > 0) {
      const mapped = data.map(t => ({
        id: t.id,
        name: t.name,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
      }))
      saveLocalTemplates(mapped, departmentId)
      return mapped
    }
    // Se banco vazio, tentar migrar do localStorage (apenas quando tem dept)
    const local = loadLocalTemplates(departmentId)
    if (local.length > 0 && departmentId) {
      await migrateTemplatesToDB(local, user, departmentId)
    }
    return local
  } catch {
    logger.warn('Templates', 'Tabela ticket_templates não disponível, usando localStorage')
    return loadLocalTemplates(departmentId)
  }
}

async function migrateTemplatesToDB(templates: TicketTemplate[], user: string, departmentId: string): Promise<void> {
  try {
    const rows = templates.map(t => ({
      name: t.name,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      created_by: user,
      department_id: departmentId,
    }))
    await supabase.from('ticket_templates').insert(rows)
    logger.info('Templates', `Migrados ${templates.length} templates do localStorage para o banco`)
  } catch {
    logger.warn('Templates', 'Falha ao migrar templates para o banco')
  }
}

export async function insertTemplate(template: Omit<TicketTemplate, 'id'>, user: string, departmentId?: string | null): Promise<TicketTemplate | null> {
  const parsed = TemplateInsertSchema.safeParse(template)
  if (!parsed.success) {
    logger.warn('Templates', 'Payload inválido', { issues: parsed.error.issues })
    return null
  }
  try {
    const payload: Record<string, unknown> = { ...parsed.data, created_by: user }
    if (departmentId) payload.department_id = departmentId
    const { data, error } = await supabase
      .from('ticket_templates')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    const t = data
    return { id: t.id, name: t.name, title: t.title, description: t.description, priority: t.priority, status: t.status }
  } catch {
    // Fallback localStorage
    const id = `tmpl-${Date.now()}`
    const newTemplate = { ...template, id }
    const all = loadLocalTemplates(departmentId)
    all.push(newTemplate)
    saveLocalTemplates(all, departmentId)
    return newTemplate
  }
}

export async function deleteTemplate(id: string, departmentId?: string | null): Promise<void> {
  try {
    const { error } = await supabase.from('ticket_templates').delete().eq('id', id)
    if (error) throw error
  } catch {
    // Fallback localStorage
    const all = loadLocalTemplates(departmentId)
    saveLocalTemplates(all.filter(t => t.id !== id), departmentId)
  }
}

// ── Auto Rules ───────────────────────────────────────────────

interface AutoRuleLocal {
  id: string
  name: string
  condition: string
  action: string
  targetColumn: string
  enabled: boolean
}

function loadLocalRules(departmentId?: string | null): AutoRuleLocal[] {
  try {
    const raw = localStorage.getItem(rulesCacheKey(departmentId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveLocalRules(rules: AutoRuleLocal[], departmentId?: string | null): void {
  localStorage.setItem(rulesCacheKey(departmentId), JSON.stringify(rules))
}

export async function fetchAutoRules(user: string, departmentId?: string | null): Promise<AutoRuleLocal[]> {
  try {
    let query = supabase.from('auto_rules').select('*').order('name', { ascending: true })
    if (departmentId) query = query.eq('department_id', departmentId)
    const { data, error } = await query
    if (error) throw error
    if (data && data.length > 0) {
      const mapped = data.map(r => ({
        id: r.id,
        name: r.name,
        condition: r.condition,
        action: r.action,
        targetColumn: r.target_column,
        enabled: r.enabled,
      }))
      saveLocalRules(mapped, departmentId)
      return mapped
    }
    // Migrar do localStorage se banco vazio
    const local = loadLocalRules(departmentId)
    if (local.length > 0) {
      await migrateRulesToDB(local, user, departmentId)
    }
    return local
  } catch {
    logger.warn('AutoRules', 'Tabela auto_rules não disponível, usando localStorage')
    return loadLocalRules(departmentId)
  }
}

async function migrateRulesToDB(rules: AutoRuleLocal[], user: string, departmentId?: string | null): Promise<void> {
  try {
    const rows = rules.map(r => ({
      name: r.name,
      condition: r.condition,
      action: r.action,
      target_column: r.targetColumn,
      enabled: r.enabled,
      created_by: user,
      department_id: departmentId ?? null,
    }))
    await supabase.from('auto_rules').insert(rows)
    logger.info('AutoRules', `Migradas ${rules.length} regras do localStorage para o banco`)
  } catch {
    logger.warn('AutoRules', 'Falha ao migrar regras para o banco')
  }
}

export async function insertAutoRule(rule: Omit<AutoRuleLocal, 'id'>, user: string, departmentId?: string | null): Promise<AutoRuleLocal | null> {
  const parsed = AutoRuleInsertSchema.safeParse(rule)
  if (!parsed.success) {
    logger.warn('AutoRules', 'Payload inválido', { issues: parsed.error.issues })
    return null
  }
  try {
    const { data, error } = await supabase
      .from('auto_rules')
      .insert({
        name: parsed.data.name,
        condition: parsed.data.condition,
        action: parsed.data.action,
        target_column: parsed.data.targetColumn,
        enabled: parsed.data.enabled,
        created_by: user,
        department_id: departmentId ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return { id: data.id, name: data.name, condition: data.condition, action: data.action, targetColumn: data.target_column, enabled: data.enabled }
  } catch {
    const id = `rule-${Date.now()}`
    const newRule = { ...rule, id }
    const all = loadLocalRules(departmentId)
    all.push(newRule)
    saveLocalRules(all, departmentId)
    return newRule
  }
}

export async function updateAutoRule(id: string, updates: Partial<AutoRuleLocal>, departmentId?: string | null): Promise<void> {
  try {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled
    if (updates.name) dbUpdates.name = updates.name
    if (updates.condition) dbUpdates.condition = updates.condition
    if (updates.targetColumn) dbUpdates.target_column = updates.targetColumn
    const { error } = await supabase.from('auto_rules').update(dbUpdates).eq('id', id)
    if (error) throw error
  } catch {
    const all = loadLocalRules(departmentId)
    saveLocalRules(all.map(r => r.id === id ? { ...r, ...updates } : r), departmentId)
  }
}

export async function deleteAutoRule(id: string, departmentId?: string | null): Promise<void> {
  try {
    const { error } = await supabase.from('auto_rules').delete().eq('id', id)
    if (error) throw error
  } catch {
    const all = loadLocalRules(departmentId)
    saveLocalRules(all.filter(r => r.id !== id), departmentId)
  }
}

// Leitor síncrono do cache local por departamento (usado pelo hook useAutoRules)
export function loadAutoRulesCache(departmentId?: string | null): AutoRuleLocal[] {
  return loadLocalRules(departmentId)
}
