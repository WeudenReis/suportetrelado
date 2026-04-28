import { describe, it, expect } from 'vitest'

// Importar a função real (não mockada) para testar lógica pura
// extractMentionNames é uma função pura sem dependência do Supabase client
import { extractMentionNames } from '../supabase'

describe('extractMentionNames', () => {
  it('deve extrair nomes mencionados com @', () => {
    const result = extractMentionNames('Olá @joao e @maria, vejam isso')
    expect(result).toEqual(['joao', 'maria'])
  })

  it('deve extrair nome completo quando a menção usa NBSP', () => {
    const nbsp = '\u00A0'
    const result = extractMentionNames(`Ainda está comigo o cliente @Maria${nbsp}Sousa`)
    expect(result).toEqual(['maria sousa'])
  })

  it('deve extrair nome completo quando a menção usa espaço normal', () => {
    const result = extractMentionNames('Ainda está comigo o cliente @Rafael The Boss')
    expect(result).toEqual(['rafael the boss'])
  })

  it('deve retornar array vazio quando não há menções', () => {
    const result = extractMentionNames('Sem menções aqui')
    expect(result).toEqual([])
  })

  it('deve remover duplicatas', () => {
    const result = extractMentionNames('@joao fez algo e @joao respondeu')
    expect(result).toEqual(['joao'])
  })

  it('deve lidar com nomes acentuados', () => {
    const result = extractMentionNames('Fala @josé e @André')
    expect(result).toEqual(['josé', 'andré'])
  })

  it('deve extrair menção no início do texto', () => {
    const result = extractMentionNames('@admin preciso de ajuda')
    expect(result).toEqual(['admin'])
  })

  it('deve lidar com texto vazio', () => {
    const result = extractMentionNames('')
    expect(result).toEqual([])
  })
})
