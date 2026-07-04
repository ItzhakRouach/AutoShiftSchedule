import { describe, it, expect } from 'vitest'
import { SHIFT_META, SHIFT_ORDER, ROLES, ROLE_META, FALLBACK_12H_ORDER } from './constants'

describe('domain constants', () => {
  it('defines 3 base 8h shifts in order', () => {
    expect(SHIFT_ORDER).toEqual(['morning', 'noon', 'night'])
    expect(SHIFT_META.morning.hours).toBe(8)
    expect(SHIFT_META.morning.start).toBe(7)
    expect(SHIFT_META.night.start).toBe(23)
  })
  it('defines the three security roles with metadata', () => {
    expect(ROLES).toEqual(['אחמ״ש', 'מוקדן', 'מאבטח'])
    expect(ROLE_META['מאבטח'].color).toBe('#13A98E')
  })
  it('offers only the day/night 12h pair (off-cycle variants removed)', () => {
    expect(FALLBACK_12H_ORDER).toEqual(['m12_day', 'm12_night'])
    for (const id of FALLBACK_12H_ORDER) {
      expect(SHIFT_META[id].hours).toBe(12)
      expect(SHIFT_META[id].isFallback).toBe(true)
    }
  })
  it('keeps 03-15/15-03 as valid historical shift types (not auto-assigned)', () => {
    // The off-cycle variants are no longer scheduled or offered, but their metadata
    // stays defined so historical persisted rows still type-check and render.
    for (const id of ['m12_3to15', 'm12_15to3'] as const) {
      expect(SHIFT_META[id].hours).toBe(12)
      expect(SHIFT_META[id].isFallback).toBe(true)
    }
  })
  it('marks base shifts as non-fallback', () => {
    for (const id of SHIFT_ORDER) {
      expect(SHIFT_META[id].isFallback).toBe(false)
    }
  })
})
