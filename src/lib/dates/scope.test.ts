import { describe, it, expect } from 'vitest'
import { scopeStartISO } from './scope'

describe('scopeStartISO — calendar-period boundaries (local time)', () => {
  // Wed 2026-07-15 (mid-month, mid-year, mid-week). Week starts Sunday 2026-07-12.
  const mid = new Date(2026, 6, 15, 13, 30)

  it('week = the current week Sunday', () => {
    expect(scopeStartISO('week', mid)).toBe('2026-07-12')
  })

  it('month = the 1st of the current month', () => {
    expect(scopeStartISO('month', mid)).toBe('2026-07-01')
  })

  it('year = Jan 1 of the current year', () => {
    expect(scopeStartISO('year', mid)).toBe('2026-01-01')
  })

  it('nesting holds: year ≤ month ≤ week', () => {
    expect(scopeStartISO('year', mid) <= scopeStartISO('month', mid)).toBe(true)
    expect(scopeStartISO('month', mid) <= scopeStartISO('week', mid)).toBe(true)
  })

  it('on a Sunday, week = today itself', () => {
    const sunday = new Date(2026, 6, 12, 9, 0) // 2026-07-12 is a Sunday
    expect(scopeStartISO('week', sunday)).toBe('2026-07-12')
  })

  it('on the 1st, month = today', () => {
    const first = new Date(2026, 6, 1, 9, 0)
    expect(scopeStartISO('month', first)).toBe('2026-07-01')
  })

  it('on Jan 1, all three collapse to Jan 1 when it is a Sunday-aligned edge', () => {
    // 2026-01-01 is a Thursday; year=Jan1, month=Jan1, week=prior Sunday 2025-12-28.
    const jan1 = new Date(2026, 0, 1, 9, 0)
    expect(scopeStartISO('year', jan1)).toBe('2026-01-01')
    expect(scopeStartISO('month', jan1)).toBe('2026-01-01')
    expect(scopeStartISO('week', jan1)).toBe('2025-12-28')
  })
})
