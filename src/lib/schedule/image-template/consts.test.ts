import { describe, expect, it } from 'vitest'
import { flatten16, zebraTint } from './consts'

// Locks the precomputed tints to the app's color-mix(in srgb, C 16%, white)
// values (WeekTableBody role/shift label cells), so the PNG matches the table.
describe('flatten16', () => {
  it('matches the role label tints from the live table', () => {
    expect(flatten16('#E0902A')).toBe('#FAEDDD') // אחמ״ש
    expect(flatten16('#3D6BF5')).toBe('#E0E7FD') // מוקדן
    expect(flatten16('#13A98E')).toBe('#D9F1ED') // מאבטח
  })

  it('matches the shift label tints', () => {
    expect(flatten16('#F2A93B')).toBe('#FDF1E0') // בוקר
    expect(flatten16('#EB6A4E')).toBe('#FCE7E3') // צהריים
    expect(flatten16('#5B61D6')).toBe('#E5E6F8') // לילה
  })

  it('falls back to white for malformed colors', () => {
    expect(flatten16('not-a-color')).toBe('#FFFFFF')
  })
})

describe('zebraTint', () => {
  it('produces a fainter tint than the label cells', () => {
    // Faint but not white — the even-row zebra wash.
    expect(zebraTint('#F2A93B')).not.toBe('#FFFFFF')
    expect(zebraTint('#F2A93B') > flatten16('#F2A93B')).toBe(true) // lighter hex sorts higher
  })
})
