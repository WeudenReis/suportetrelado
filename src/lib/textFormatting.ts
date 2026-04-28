import { splitTextWithMentions, MentionParseOptions, MentionSegment } from './mentions'

export type RichTextSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'highlight'; value: string }

const FORMAT_MARKERS = [
  { marker: '**', type: 'bold' as const },
  { marker: '==', type: 'highlight' as const },
]

function splitFormatting(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = []
  let position = 0

  while (position < text.length) {
    let nextMarker: { index: number; marker: string; type: 'bold' | 'highlight' } | null = null

    for (const candidate of FORMAT_MARKERS) {
      const found = text.indexOf(candidate.marker, position)
      if (found !== -1 && (nextMarker === null || found < nextMarker.index)) {
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
    const end = text.indexOf(nextMarker.marker, start)
    if (end === -1) {
      segments.push({ type: 'text', value: text.slice(nextMarker.index) })
      break
    }

    const inner = text.slice(start, end)
    segments.push({ type: nextMarker.type, value: inner })
    position = end + nextMarker.marker.length
  }

  return segments
}

export function parseRichText(text: string, opts?: MentionParseOptions): RichTextSegment[] {
  const fragments = splitTextWithMentions(text, opts)
  return fragments.flatMap(fragment => {
    if (fragment.type === 'text') {
      return splitFormatting(fragment.value)
    }
    return fragment
  })
}

export { extractMentionDisplayNames } from './mentions'
