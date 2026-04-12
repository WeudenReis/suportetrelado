import { describe, it, expect } from 'vitest'
import {
  TicketInsertSchema,
  CommentInsertSchema,
  TemplateInsertSchema,
  AutoRuleInsertSchema,
  parseOrThrow,
} from '../schemas'

const VALID_UUID = '11111111-1111-1111-1111-111111111111'

describe('TicketInsertSchema', () => {
  it('aceita payload mínimo válido', () => {
    const r = TicketInsertSchema.safeParse({
      title: 'Bug urgente',
      description: '',
      status: 'backlog',
      priority: 'high',
      department_id: VALID_UUID,
    })
    expect(r.success).toBe(true)
  })

  it('rejeita título vazio', () => {
    const r = TicketInsertSchema.safeParse({
      title: '   ',
      description: 'x',
      status: 'backlog',
      priority: 'low',
      department_id: VALID_UUID,
    })
    expect(r.success).toBe(false)
  })

  it('rejeita prioridade inválida', () => {
    const r = TicketInsertSchema.safeParse({
      title: 'ok',
      description: '',
      status: 'backlog',
      priority: 'urgent',
      department_id: VALID_UUID,
    })
    expect(r.success).toBe(false)
  })

  it('rejeita department_id não-UUID', () => {
    const r = TicketInsertSchema.safeParse({
      title: 'ok',
      description: '',
      status: 'backlog',
      priority: 'medium',
      department_id: 'not-a-uuid',
    })
    expect(r.success).toBe(false)
  })

  it('preserva campos extras via passthrough', () => {
    const r = TicketInsertSchema.safeParse({
      title: 'ok',
      description: '',
      status: 'backlog',
      priority: 'medium',
      department_id: VALID_UUID,
      assignee: 'joao',
      custom_field: 42,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect((r.data as { custom_field?: number }).custom_field).toBe(42)
    }
  })
})

describe('CommentInsertSchema', () => {
  it('aceita comentário válido', () => {
    const r = CommentInsertSchema.safeParse({
      ticket_id: VALID_UUID,
      user_name: 'joao',
      content: 'mensagem',
    })
    expect(r.success).toBe(true)
  })

  it('rejeita conteúdo vazio', () => {
    const r = CommentInsertSchema.safeParse({
      ticket_id: VALID_UUID,
      user_name: 'joao',
      content: '   ',
    })
    expect(r.success).toBe(false)
  })
})

describe('TemplateInsertSchema', () => {
  it('aceita template válido', () => {
    const r = TemplateInsertSchema.safeParse({
      name: 'Login issue',
      title: 'Cliente não consegue logar',
      description: 'passos...',
      priority: 'medium',
      status: 'backlog',
    })
    expect(r.success).toBe(true)
  })

  it('rejeita nome vazio', () => {
    const r = TemplateInsertSchema.safeParse({
      name: '',
      title: 'x',
      description: '',
      priority: 'low',
      status: 'backlog',
    })
    expect(r.success).toBe(false)
  })
})

describe('AutoRuleInsertSchema', () => {
  it('aceita regra válida', () => {
    const r = AutoRuleInsertSchema.safeParse({
      name: 'auto resolved',
      condition: 'status:resolved',
      action: 'move',
      targetColumn: 'resolved',
      enabled: true,
    })
    expect(r.success).toBe(true)
  })
})

describe('parseOrThrow', () => {
  it('retorna dados quando válido', () => {
    const data = parseOrThrow(
      TemplateInsertSchema,
      { name: 'a', title: 'b', description: '', priority: 'low', status: 'backlog' },
      'test',
    )
    expect(data.name).toBe('a')
  })

  it('lança erro com contexto quando inválido', () => {
    expect(() =>
      parseOrThrow(
        TemplateInsertSchema,
        { name: '', title: 'b', description: '', priority: 'low', status: 'backlog' },
        'test',
      ),
    ).toThrow(/\[test\] Payload inválido/)
  })
})
