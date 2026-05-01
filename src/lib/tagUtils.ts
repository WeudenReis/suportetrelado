/** Parse tag stored as "name|#color" or legacy plain "name" */
export function parseTag(raw: string): { name: string; color: string } {
  const idx = raw.lastIndexOf('|')
  if (idx > 0 && raw[idx + 1] === '#') {
    return { name: raw.slice(0, idx), color: raw.slice(idx + 1) }
  }
  // Legacy: auto-generate color
  return { name: raw, color: `hsl(${(raw.charCodeAt(0) * 47) % 360}, 55%, 45%)` }
}
