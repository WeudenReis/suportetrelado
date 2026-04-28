export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }

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

export function splitTextWithMentions(text: string): MentionSegment[] {
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

export function extractMentionDisplayNames(text: string): string[] {
  const segments = splitTextWithMentions(text)
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
