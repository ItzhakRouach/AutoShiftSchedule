import { describe, it, expect } from 'vitest'
import { deadlineDateTime, isPastDeadline } from './compute'

// Fixture: weekStart = Sunday 2026-06-07, dow=4 (Thursday), time='18:00'
// Deadline = Thu 2026-06-04 18:00 local
// weekStart (2026-06-07) - 7 days = 2026-05-31 (previous Sunday)
// 2026-05-31 + 4 days = 2026-06-04 (Thursday) @ 18:00

describe('deadlineDateTime', () => {
  it('computes Thursday 18:00 deadline for week starting 2026-06-07', () => {
    const d = deadlineDateTime('2026-06-07', 4, '18:00')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5) // June = 5 (0-indexed)
    expect(d.getDate()).toBe(4)
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(0)
  })

  it('computes Sunday 09:00 deadline for week starting 2026-06-07 (dow=0)', () => {
    // weekStart - 7 = 2026-05-31, + 0 = 2026-05-31 Sun @ 09:00
    const d = deadlineDateTime('2026-06-07', 0, '09:00')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // May = 4
    expect(d.getDate()).toBe(31)
    expect(d.getHours()).toBe(9)
    expect(d.getMinutes()).toBe(0)
  })

  it('computes Saturday 23:59 deadline (dow=6)', () => {
    // 2026-06-07 - 7 = 2026-05-31, + 6 = 2026-06-06 Sat @ 23:59
    const d = deadlineDateTime('2026-06-07', 6, '23:59')
    expect(d.getDate()).toBe(6)
    expect(d.getMonth()).toBe(5)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
  })
})

describe('isPastDeadline', () => {
  const weekStart = '2026-06-07'
  const dow = 4       // Thursday
  const time = '18:00'
  // Deadline = Thu 2026-06-04 18:00

  it('returns true when now is after the deadline', () => {
    // Friday 2026-06-05 10:00 — past the Thu 18:00 deadline
    const now = new Date(2026, 5, 5, 10, 0)
    expect(isPastDeadline(now, weekStart, dow, time)).toBe(true)
  })

  it('returns false when now is before the deadline', () => {
    // Thursday 2026-06-04 12:00 — before the 18:00 deadline
    const now = new Date(2026, 5, 4, 12, 0)
    expect(isPastDeadline(now, weekStart, dow, time)).toBe(false)
  })

  it('returns false when now is exactly at the deadline', () => {
    // Exactly Thu 2026-06-04 18:00 — not yet past
    const now = new Date(2026, 5, 4, 18, 0)
    expect(isPastDeadline(now, weekStart, dow, time)).toBe(false)
  })

  it('returns true one minute after the deadline', () => {
    const now = new Date(2026, 5, 4, 18, 1)
    expect(isPastDeadline(now, weekStart, dow, time)).toBe(true)
  })
})
