/**
 * Schemas Zod para validação nas fronteiras (inserts/updates no Supabase).
 * Centraliza tamanhos máximos, enums e formatos aceitos pelo banco.
 *
 * Uso:
 *   TicketInsertSchema.parse(payload)  // lança ZodError se inválido
 *   TicketInsertSchema.safeParse(payload) // retorna { success, data | error }
 */
import { z } from 'zod'

// ── Limites compartilhados ─────────────────────────────────────
const MAX_TITLE = 200
const MAX_DESCRIPTION = 10_000
const MAX_COMMENT = 5_000
const MAX_URL = 2_048
const MAX_NAME = 120

export const priorityEnum = z.enum(['low', 'medium', 'high'])
// UUID-shaped (aceita qualquer versão incluindo os UUIDs fixos de seed/migration).
// Zod v4.uuid() exige version bits estritos; regex simples cobre melhor o caso real.
export const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'UUID inválido')

// ── Ticket ─────────────────────────────────────────────────────
export const TicketInsertSchema = z.object({
  title: z.string().trim().min(1, 'Título obrigatório').max(MAX_TITLE),
  description: z.string().max(MAX_DESCRIPTION).default(''),
  status: z.string().min(1).max(64),
  priority: priorityEnum,
  department_id: uuidSchema,
  cliente: z.string().max(MAX_NAME).nullish(),
  instancia: z.string().max(MAX_NAME).nullish(),
  link_retaguarda: z.string().url().max(MAX_URL).nullish().or(z.literal('')),
  assignee: z.string().max(MAX_NAME).nullish(),
  tags: z.array(z.string().max(40)).max(20).nullish(),
}).passthrough()

export const TicketUpdateSchema = TicketInsertSchema.partial().extend({
  id: uuidSchema.optional(),
})

// ── Comment ────────────────────────────────────────────────────
export const CommentInsertSchema = z.object({
  ticket_id: uuidSchema,
  user_name: z.string().trim().min(1).max(MAX_NAME),
  content: z.string().trim().min(1, 'Comentário vazio').max(MAX_COMMENT),
  department_id: uuidSchema.nullish(),
})

// ── Template ───────────────────────────────────────────────────
export const TemplateInsertSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME),
  title: z.string().trim().min(1).max(MAX_TITLE),
  description: z.string().max(MAX_DESCRIPTION).default(''),
  priority: priorityEnum,
  status: z.string().min(1).max(64),
})

// ── AutoRule ───────────────────────────────────────────────────
export const AutoRuleInsertSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME),
  condition: z.string().min(1).max(500),
  action: z.string().min(1).max(100),
  targetColumn: z.string().min(1).max(64),
  enabled: z.boolean(),
})

// ── Link (card de referência externa) ──────────────────────────
export const LinkInsertSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME),
  url: z.string().url().max(MAX_URL),
  department_id: uuidSchema.nullish(),
  category: z.string().max(64).nullish(),
})

// ── Helper genérico ────────────────────────────────────────────
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, context: string): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`[${context}] Payload inválido: ${msg}`)
  }
  return result.data
}
