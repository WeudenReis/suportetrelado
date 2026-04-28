import { describe, it, expect } from 'vitest'

import { extractMentionDisplayNames, splitTextWithMentions } from '../mentions'

describe('mentions (knownMentions)', () => {
  it('deve limitar a menção ao maior match conhecido (sem engolir texto depois)', () => {
    const text = '@Rafael The Boss Oi Oi Oi'
    const segments = splitTextWithMentions(text, { knownMentions: ['Rafael The Boss'] })
    expect(segments).toEqual([
      { type: 'mention', value: '@Rafael The Boss' },
      { type: 'text', value: ' Oi Oi Oi' },
    ])
  })

  it('deve suportar NBSP entre as palavras do nome', () => {
    const nbsp = '\u00A0'
    const text = `@Rafael${nbsp}The${nbsp}Boss Oi`
    const segments = splitTextWithMentions(text, { knownMentions: ['Rafael The Boss'] })
    expect(segments).toEqual([
      { type: 'mention', value: `@Rafael${nbsp}The${nbsp}Boss` },
      { type: 'text', value: ' Oi' },
    ])
  })

  it('extractMentionDisplayNames não deve capturar texto extra após o nome', () => {
    const text = 'Fala com @Rafael The Boss Oi Oi'
    const names = extractMentionDisplayNames(text, { knownMentions: ['Rafael The Boss'] })
    expect(names).toEqual(['rafael the boss'])
  })
})
