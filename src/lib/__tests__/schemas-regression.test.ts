/**
 * Regressão automatizada do incidente 22-23/04/2026.
 *
 * Bug: TicketUpdateSchema = TicketInsertSchema.partial() preservava
 * `description: z.string().default('')`. Qualquer update parcial
 * (ex.: drag de card → { status }) reidratava `description = ''`,
 * sobrescrevendo o conteúdo no banco em todos os 23 tickets.
 *
 * Padrão correto (já aplicado em Ticket e Template):
 *   const XBaseSchema = z.object({ ...sem defaults... })
 *   export const XInsertSchema = XBaseSchema.extend({ campo: ....default(...) })
 *   export const XUpdateSchema = XBaseSchema.partial()
 *
 * Se este arquivo de testes começar a falhar, alguém reintroduziu o bug.
 * NÃO altere os testes — corrija o schema.
 */
import { describe, it, expect } from 'vitest'
import {
  TicketInsertSchema,
  TicketUpdateSchema,
  TemplateInsertSchema,
  TemplateUpdateSchema,
} from '../schemas'

const VALID_UUID = '11111111-1111-1111-1111-111111111111'

describe('Regressão incidente 22-23/04/2026 — Update schemas não devem injetar defaults', () => {
  describe('TicketUpdateSchema', () => {
    it('NÃO injeta description quando ausente do payload (root cause do incidente)', () => {
      const r = TicketUpdateSchema.safeParse({ status: 'em_tratativa_xxx' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data).not.toHaveProperty('description')
      }
    })

    it('preserva description quando explicitamente enviada', () => {
      const r = TicketUpdateSchema.safeParse({ description: 'conteúdo do usuário' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.description).toBe('conteúdo do usuário')
      }
    })

    it('aceita description vazia explícita (limpeza intencional pelo usuário)', () => {
      const r = TicketUpdateSchema.safeParse({ description: '' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.description).toBe('')
      }
    })

    it('aceita update apenas com priority, sem reidratar outros campos', () => {
      const r = TicketUpdateSchema.safeParse({ priority: 'high' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data).toEqual({ priority: 'high' })
      }
    })

    it('aceita update apenas com title, sem reidratar outros campos', () => {
      const r = TicketUpdateSchema.safeParse({ title: 'novo título' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data).toEqual({ title: 'novo título' })
      }
    })
  })

  describe('TemplateUpdateSchema', () => {
    it('NÃO injeta description quando ausente do payload', () => {
      const r = TemplateUpdateSchema.safeParse({ name: 'novo nome' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data).not.toHaveProperty('description')
      }
    })

    it('preserva description quando explicitamente enviada', () => {
      const r = TemplateUpdateSchema.safeParse({ description: 'corpo do template' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.description).toBe('corpo do template')
      }
    })

    it('aceita update vazio sem reidratar nenhum campo', () => {
      const r = TemplateUpdateSchema.safeParse({})
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data).toEqual({})
      }
    })
  })

  describe('Insert schemas — defaults continuam funcionando (lado positivo)', () => {
    it('TicketInsertSchema aplica default em description ausente', () => {
      const r = TicketInsertSchema.safeParse({
        title: 'novo ticket',
        status: 'backlog',
        priority: 'low',
        department_id: VALID_UUID,
      })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.description).toBe('')
      }
    })

    it('TemplateInsertSchema aplica default em description ausente', () => {
      const r = TemplateInsertSchema.safeParse({
        name: 'tmpl',
        title: 'título',
        priority: 'low',
        status: 'backlog',
      })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.description).toBe('')
      }
    })
  })
})
