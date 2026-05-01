export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }

export type MentionParseOptions = {
  /**
   * Lista de menções válidas (ex.: nomes de usuários, aliases) para casar o texto após o '@'.
   * Se fornecido, o parser tenta usar o maior match e evita capturar palavras extras.
   */
  knownMentions?: readonly string[]
}

function isWordChar(ch: string): boolean {
  // Letras/dígitos/underscore + faixa latina estendida (acentos)
  return /[\w\u00C0-\u024F]/.test(ch)
}

function isUppercaseLetter(ch: string): boolean {
  return /[A-Z\u00C0-\u00D6\u00D8-\u00DE]/.test(ch)
}

function readWord(text: string, start: number): { word: string; next: number } {
  let i = start
  while (i < text.length && isWordChar(text[i])) i++
  return { word: text.slice(start, i), next: i }
}

function skipSpaces(text: string, start: number): number {
  let i = start
  while (i < text.length && text[i] === ' ') i++
  return i
}

function isMentionSeparator(ch: string): boolean {
  return ch === ' ' || ch === '\u00A0'
}

function skipMentionSeparators(text: string, start: number): number {
  let i = start
  while (i < text.length && isMentionSeparator(text[i])) i++
  return i
}

function normalizeForCompare(s: string): string {
  return s
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function candidateToWords(candidate: string): string[] {
  const normalized = normalizeForCompare(candidate)
  if (!normalized) return []
  return normalized.split(' ').filter(Boolean)
}

function matchKnownMentionAt(text: string, start: number, candidate: string): number | null {
  const words = candidateToWords(candidate)
  if (words.length === 0) return null

  let pos = start
  for (let w = 0; w < words.length; w++) {
    const current = readWord(text, pos)
    if (!current.word) return null
    if (normalizeForCompare(current.word) !== words[w]) return null

    pos = current.next

    if (w < words.length - 1) {
      if (pos >= text.length || !isMentionSeparator(text[pos])) return null
      pos = skipMentionSeparators(text, pos)
      if (pos >= text.length) return null
    }
  }

  // Evita casar prefixo dentro de uma palavra maior (ex.: @joaozinho não deve casar @joao)
  if (pos < text.length && isWordChar(text[pos])) return null
  return pos
}

export function splitTextWithMentions(text: string, opts?: MentionParseOptions): MentionSegment[] {
  if (!text) return [{ type: 'text', value: '' }]

  const segments: MentionSegment[] = []
  let i = 0
  let lastTextStart = 0

  const pushTextUntil = (end: number) => {
    if (end > lastTextStart) {
      segments.push({ type: 'text', value: text.slice(lastTextStart, end) })
    }
  }

  while (i < text.length) {
    if (text[i] !== '@') {
      i++
      continue
    }

    const atPos = i

    // Se houver lista de menções conhecidas, tenta casar o maior match
    const knownMentions = opts?.knownMentions
    if (knownMentions && knownMentions.length > 0) {
      let bestEnd: number | null = null
      for (const candidate of knownMentions) {
        const end = matchKnownMentionAt(text, atPos + 1, candidate)
        if (end !== null && (bestEnd === null || end > bestEnd)) bestEnd = end
      }
      if (bestEnd !== null) {
        pushTextUntil(atPos)
        segments.push({ type: 'mention', value: text.slice(atPos, bestEnd) })
        i = bestEnd
        lastTextStart = bestEnd
        continue
      }
    }

    const first = readWord(text, atPos + 1)
    if (!first.word) {
      i++
      continue
    }

    let mentionEnd = first.next

    // Tenta consumir palavras adicionais que parecem parte do nome
    while (mentionEnd < text.length) {
      const sep = text[mentionEnd]

      // Caso 1: NBSP sempre continua a menção
      if (sep === '\u00A0') {
        const next = readWord(text, mentionEnd + 1)
        if (!next.word) break
        mentionEnd = next.next
        continue
      }

      // Caso 2: Espaço normal só continua se a próxima palavra "parecer nome"
      if (sep === ' ') {
        const nextStart = skipSpaces(text, mentionEnd + 1)
        const next = readWord(text, nextStart)
        if (!next.word) break

        const nextWord = next.word
        const nextFirstChar = nextWord.charAt(0)
        const nextLower = nextWord.toLowerCase()

        // Partículas comuns em nomes (ex.: "da Silva")
        const isConnector = nextLower === 'da' || nextLower === 'de' || nextLower === 'do' || nextLower === 'dos' || nextLower === 'das'

        // Aceita Palavra Capitalizada (Rafael The Boss, Maria Sousa)
        if (isUppercaseLetter(nextFirstChar)) {
          mentionEnd = next.next
          continue
        }

        // Aceita conector apenas se houver próxima palavra capitalizada
        if (isConnector) {
          const afterStart = skipSpaces(text, next.next)
          const afterConnector = readWord(text, afterStart)
          if (afterConnector.word && isUppercaseLetter(afterConnector.word.charAt(0))) {
            mentionEnd = afterConnector.next
            continue
          }
        }

        break
      }

      break
    }

    // Emite segmentos
    pushTextUntil(atPos)
    segments.push({ type: 'mention', value: text.slice(atPos, mentionEnd) })
    i = mentionEnd
    lastTextStart = mentionEnd
  }

  if (lastTextStart < text.length) {
    segments.push({ type: 'text', value: text.slice(lastTextStart) })
  }

  return segments
}

export function extractMentionDisplayNames(text: string, opts?: MentionParseOptions): string[] {
  const segments = splitTextWithMentions(text, opts)
  const names = segments
    .filter(s => s.type === 'mention')
    .map(s => s.value
      .slice(1)
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    )

  return [...new Set(names)]
}
