import { describe, expect, it } from 'vitest'
import { toVisualHebrew } from './bidi'

describe('toVisualHebrew', () => {
  it('returns empty string for nullish input', () => {
    expect(toVisualHebrew('')).toBe('')
    expect(toVisualHebrew(null)).toBe('')
    expect(toVisualHebrew(undefined)).toBe('')
  })

  it('leaves pure ASCII unchanged', () => {
    expect(toVisualHebrew('AutoShift')).toBe('AutoShift')
    expect(toVisualHebrew('12.34')).toBe('12.34')
  })

  it('reorders a pure Hebrew word into visual (left-to-right pixel) order', () => {
    // logical/memory order of 'ראשון' is ר,א,ש,ו,ן
    // visually drawn LTR pixel order should start with ן and end with ר
    const out = toVisualHebrew('ראשון')
    expect(out).toHaveLength(5)
    expect(out[0]).toBe('ן')
    expect(out[4]).toBe('ר')
  })

  it('keeps numbers in their original sequence inside mixed RTL text', () => {
    const out = toVisualHebrew('סידור שבועי · 31.5 – 6.6.2026')
    // numbers are LTR runs; their internal sequence must not reverse
    expect(out).toContain('31.5')
    expect(out).toContain('6.6.2026')
  })

  it('produces the same string length as the input', () => {
    const input = 'אחמ״ש / מוקדן / מאבטח · 7.6'
    expect(toVisualHebrew(input)).toHaveLength(input.length)
  })
})
