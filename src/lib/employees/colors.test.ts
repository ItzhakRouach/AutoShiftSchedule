import { describe, it, expect } from 'vitest'
import { EMPLOYEE_COLORS, pickUniqueColor } from './colors'

describe('pickUniqueColor', () => {
  it('returns the first palette color when existing is empty', () => {
    const result = pickUniqueColor([])
    expect(result).toBe(EMPLOYEE_COLORS[0])
  })

  it('returns the first palette color not in existing', () => {
    const existing = [EMPLOYEE_COLORS[0], EMPLOYEE_COLORS[1]]
    const result = pickUniqueColor(existing)
    expect(result).toBe(EMPLOYEE_COLORS[2])
  })

  it('is case-insensitive when matching existing colors', () => {
    const existing = [EMPLOYEE_COLORS[0].toUpperCase()]
    const result = pickUniqueColor(existing)
    // Should skip EMPLOYEE_COLORS[0] and return EMPLOYEE_COLORS[1]
    expect(result).toBe(EMPLOYEE_COLORS[1])
  })

  it('generates a unique overflow color when all palette colors are taken', () => {
    const result = pickUniqueColor([...EMPLOYEE_COLORS])
    // Should NOT be one of the palette colors
    expect(EMPLOYEE_COLORS.map((c) => c.toLowerCase())).not.toContain(result.toLowerCase())
    // Should be an HSL string
    expect(result).toMatch(/^hsl\(\d+, 65%, 50%\)$/)
  })

  it('never collides: overflow colors for N and N+1 are different', () => {
    const full = [...EMPLOYEE_COLORS]
    const color1 = pickUniqueColor(full)
    const color2 = pickUniqueColor([...full, color1])
    expect(color1).not.toBe(color2)
  })

  it('overflow color is always unique — different indexes produce different hues', () => {
    const full = [...EMPLOYEE_COLORS]
    const colors = new Set<string>()
    let existing = [...full]
    for (let i = 0; i < 10; i++) {
      const c = pickUniqueColor(existing)
      expect(colors.has(c)).toBe(false)
      colors.add(c)
      existing = [...existing, c]
    }
  })

  it('does not return a palette color that is in existing (full palette minus one)', () => {
    // All but the last palette color are "taken"
    const existing = EMPLOYEE_COLORS.slice(0, EMPLOYEE_COLORS.length - 1)
    const result = pickUniqueColor(existing)
    expect(result).toBe(EMPLOYEE_COLORS[EMPLOYEE_COLORS.length - 1])
  })
})
