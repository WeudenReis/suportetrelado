import { splitTextWithMentions, MentionParseOptions } from './mentions'

export type RichTextSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'underline'; value: string }
  | { type: 'strike'; value: string }
  | { type: 'code'; value: string }
  | { type: 'highlight'; value: string }
  | { type: 'link'; value: string; href: string }

export type RichTextBlock =
  | { type: 'paragraph'; segments: RichTextSegment[] }
  | { type: 'quote'; segments: RichTextSegment[] }
  | { type: 'bullet'; segments: RichTextSegment[] }
  | { type: 'numbered'; segments: RichTextSegment[] }
  | { type: 'empty' }

type InlineMarkerType = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'highlight'

// Ordem importa: marcadores mais longos antes dos menores (** > *).
const INLINE_MARKERS: { marker: string; type: InlineMarkerType }[] = [
  { marker: '**', type: 'bold' },
  { marker: '__', type: 'underline' },
  { marker: '==', type: 'highlight' },
  { marker: '`', type: 'code' },
  { marker: '~', type: 'strike' },
  { marker: '*', type: 'italic' },
]

const LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/

/** Marker de 1 char (`*`, `~`) deve ser ignorado se for parte de marker duplo (`**`, `~~`). */
function isAdjacentDouble(text: string, marker: string, idx: number): boolean {
  if (marker !== '*' && marker !== '~') return false
  return text[idx - 1] === marker || text[idx + 1] === marker
}

function findMarker(text: string, marker: string, fromIndex: number): number {
  let cursor = fromIndex
  while (cursor < text.length) {
    const found = text.indexOf(marker, cursor)
    if (found === -1) return -1
    if (isAdjacentDouble(text, marker, found)) {
      cursor = found + 1
      continue
    }
    return found
  }
  return -1
}

function splitInlineFormatting(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = []
  let position = 0

  while (position < text.length) {
    let nextMarker: { index: number; marker: string; type: InlineMarkerType } | null = null

    for (const candidate of INLINE_MARKERS) {
      const found = findMarker(text, candidate.marker, position)
      if (found === -1) continue
      if (nextMarker === null || found < nextMarker.index) {
        nextMarker = { index: found, marker: candidate.marker, type: candidate.type }
      }
    }

    if (!nextMarker) {
      segments.push({ type: 'text', value: text.slice(position) })
      break
    }

    if (nextMarker.index > position) {
      segments.push({ type: 'text', value: text.slice(position, nextMarker.index) })
    }

    const start = nextMarker.index + nextMarker.marker.length
    const end = findMarker(text, nextMarker.marker, start)
    if (end === -1) {
      segments.push({ type: 'text', value: text.slice(nextMarker.index) })
      break
    }

    segments.push({ type: nextMarker.type, value: text.slice(start, end) })
    position = end + nextMarker.marker.length
  }

  return segments
}

/** Extrai links `[texto](url)` antes de aplicar markers inline. */
function expandLinksAndFormatting(text: string): RichTextSegment[] {
  const out: RichTextSegment[] = []
  let rest = text
  while (rest.length > 0) {
    const m = rest.match(LINK_RE)
    if (!m || m.index === undefined) {
      out.push(...splitInlineFormatting(rest))
      break
    }
    if (m.index > 0) {
      out.push(...splitInlineFormatting(rest.slice(0, m.index)))
    }
    out.push({ type: 'link', value: m[1], href: m[2] })
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

/** Parser inline (mantido para comentarios). */
export function parseRichText(text: string, opts?: MentionParseOptions): RichTextSegment[] {
  const fragments = splitTextWithMentions(text, opts)
  return fragments.flatMap(fragment => {
    if (fragment.type === 'text') {
      return expandLinksAndFormatting(fragment.value)
    }
    return fragment
  })
}

/** Parser block-level: detecta listas, citacoes e paragrafos por linha. */
export function parseRichTextBlocks(text: string, opts?: MentionParseOptions): RichTextBlock[] {
  if (!text) return []
  const lines = text.split('\n')
  const blocks: RichTextBlock[] = []

  for (const line of lines) {
    if (line.trim().length === 0) {
      blocks.push({ type: 'empty' })
      continue
    }
    const trimmed = line.trimStart()
    if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'quote', segments: parseRichText(trimmed.slice(2), opts) })
      continue
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ type: 'bullet', segments: parseRichText(trimmed.slice(2), opts) })
      continue
    }
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (numberedMatch) {
      blocks.push({ type: 'numbered', segments: parseRichText(numberedMatch[2], opts) })
      continue
    }
    blocks.push({ type: 'paragraph', segments: parseRichText(line, opts) })
  }

  return blocks
}

export { extractMentionDisplayNames } from './mentions'
