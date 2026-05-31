import { describe, it, expect } from 'vitest'
import { buildSeed } from './seed'

describe('buildSeed', () => {
  const seed = buildSeed()
  it('seeds the 3 security roles with their colors', () => {
    expect(seed.roles.map(r => r.name)).toEqual(['אחמ״ש', 'מוקדן', 'מאבטח'])
    expect(seed.roles.find(r => r.name === 'מאבטח')!.color).toBe('#13A98E')
  })
  it('seeds 7 shift types: 3 base + 4 fallback, with correct flags/hours', () => {
    expect(seed.shiftTypes).toHaveLength(7)
    const base = seed.shiftTypes.filter(s => !s.is_fallback)
    const fb = seed.shiftTypes.filter(s => s.is_fallback)
    expect(base.map(s => s.key)).toEqual(['morning', 'noon', 'night'])
    expect(fb).toHaveLength(4)
    expect(base.every(s => s.hours === 8)).toBe(true)
    expect(fb.every(s => s.hours === 12)).toBe(true)
    expect(seed.shiftTypes.find(s => s.key === 'night')!.start_hour).toBe(23)
  })
  it('seeds default settings', () => {
    expect(seed.settings.min_rest_hours).toBe(8)
    expect(seed.settings.ideal_rest_hours).toBe(16)
    expect(seed.settings.allow_12h_fallback).toBe(true)
  })
  it('builds requirement templates for all 7 days, only base shifts, only count>0', () => {
    // 7 days × (morning:3 + noon:2 + night:2) = 7 × 7 = 49 rows
    expect(seed.requirements).toHaveLength(49)
    expect(seed.requirements.every(r => r.count > 0)).toBe(true)
    expect(seed.requirements.every(r => ['morning', 'noon', 'night'].includes(r.shiftKey))).toBe(true)
    const dows = new Set(seed.requirements.map(r => r.day_of_week))
    expect([...dows].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
