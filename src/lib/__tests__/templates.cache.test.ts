import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock do Supabase client para forçar fallback do localStorage
vi.mock('../supabase', () => ({
  supabase: {
    from: () => {
      throw new Error('Supabase não disponível nos testes')
    },
  },
}))

import { loadAutoRulesCache, saveLocalRules } from '../api/templates'

describe('Cache local de auto_rules por departamento', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('isola regras entre departamentos diferentes', () => {
    const deptA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const deptB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

    saveLocalRules([
      { id: 'r1', name: 'RegraA', condition: 'x', action: 'y', targetColumn: 'backlog', enabled: true },
    ], deptA)

    saveLocalRules([
      { id: 'r2', name: 'RegraB', condition: 'x', action: 'y', targetColumn: 'resolved', enabled: false },
    ], deptB)

    const fromA = loadAutoRulesCache(deptA)
    const fromB = loadAutoRulesCache(deptB)

    expect(fromA).toHaveLength(1)
    expect(fromA[0].name).toBe('RegraA')
    expect(fromB).toHaveLength(1)
    expect(fromB[0].name).toBe('RegraB')
  })

  it('retorna array vazio para dept sem cache', () => {
    const deptNovo = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    expect(loadAutoRulesCache(deptNovo)).toEqual([])
  })

  it('usa chave global quando departmentId é null', () => {
    saveLocalRules([
      { id: 'r0', name: 'Global', condition: 'x', action: 'y', targetColumn: 'backlog', enabled: true },
    ], null)
    expect(loadAutoRulesCache(null)).toHaveLength(1)
    expect(loadAutoRulesCache('abc')).toEqual([])
  })
})
