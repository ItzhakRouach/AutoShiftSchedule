import { describe, it, expect } from 'vitest'
import { rangesOverlap } from './ranges'

describe('rangesOverlap', () => {
  it('returns false for disjoint ranges (gap between them)', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-05', '2026-06-10', '2026-06-15')).toBe(false)
  })

  it('returns false for disjoint ranges in reverse order', () => {
    expect(rangesOverlap('2026-06-10', '2026-06-15', '2026-06-01', '2026-06-05')).toBe(false)
  })

  it('returns true for touching ranges — aTo === bFrom (inclusive bounds)', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-05', '2026-06-05', '2026-06-10')).toBe(true)
  })

  it('returns true for touching ranges — bTo === aFrom (inclusive bounds)', () => {
    expect(rangesOverlap('2026-06-05', '2026-06-10', '2026-06-01', '2026-06-05')).toBe(true)
  })

  it('returns true when one range is fully contained in the other', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-30', '2026-06-10', '2026-06-15')).toBe(true)
  })

  it('returns true when ranges are identical', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-05', '2026-06-01', '2026-06-05')).toBe(true)
  })

  it('returns true for overlapping single-day ranges (same day)', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-01', '2026-06-01', '2026-06-01')).toBe(true)
  })

  it('returns false for disjoint single-day ranges', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-01', '2026-06-02', '2026-06-02')).toBe(false)
  })

  it('returns true for a single-day range inside a longer range', () => {
    expect(rangesOverlap('2026-06-10', '2026-06-10', '2026-06-01', '2026-06-30')).toBe(true)
  })

  it('handles partial overlap (b starts inside a, ends after a)', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-10', '2026-06-05', '2026-06-20')).toBe(true)
  })
})
