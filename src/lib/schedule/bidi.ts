import bidiFactory from 'bidi-js'

const bidi = bidiFactory()

export function toVisualHebrew(text: string | null | undefined): string {
  if (!text) return ''
  const levels = bidi.getEmbeddingLevels(text, 'rtl')
  return bidi.getReorderedString(text, levels)
}
