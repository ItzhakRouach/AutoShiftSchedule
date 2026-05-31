import { describe, it, expect } from 'vitest'
import { deadlineDateTime, isPastDeadline } from './compute'

/**
 * Fixture: weekStart = 2026-06-07 (Sunday), dow=4 (Thursday), time='18:00', tz='Asia/Jerusalem'
 * Deadline date = 2026-06-07 − 7 + 4 = 2026-06-04 (Thursday)
 * Israel is in IDT (UTC+3) during June → 18:00 IDT = 15:00 UTC
 * Expected UTC instant: "2026-06-04T15:00:00.000Z"
 *
 * Fixture 2: wintertime — 2026-01-11 (Sunday), dow=4 (Thu), time='18:00'
 * Deadline date = 2026-01-11 − 7 + 4 = 2026-01-08 (Thursday)
 * Israel is in IST (UTC+2) during January → 18:00 IST = 16:00 UTC
 * Expected UTC instant: "2026-01-08T16:00:00.000Z"
 */

describe('deadlineDateTime (timezone-correct)', () => {
  it('summer (IDT, UTC+3): Thu 18:00 Asia/Jerusalem → 2026-06-04T15:00:00.000Z', () => {
    const d = deadlineDateTime('2026-06-07', 4, '18:00', 'Asia/Jerusalem')
    expect(d.toISOString()).toBe('2026-06-04T15:00:00.000Z')
  })

  it('winter (IST, UTC+2): Thu 18:00 Asia/Jerusalem → 2026-01-08T16:00:00.000Z', () => {
    const d = deadlineDateTime('2026-01-11', 4, '18:00', 'Asia/Jerusalem')
    expect(d.toISOString()).toBe('2026-01-08T16:00:00.000Z')
  })

  it('Sun 09:00 (dow=0): weekStart − 7 + 0 = 2026-05-31 09:00 IDT → 2026-05-31T06:00:00.000Z', () => {
    // 2026-06-07 − 7 = 2026-05-31 (Sunday); May 31 is summer → UTC+3
    const d = deadlineDateTime('2026-06-07', 0, '09:00', 'Asia/Jerusalem')
    expect(d.toISOString()).toBe('2026-05-31T06:00:00.000Z')
  })

  it('Sat 23:59 (dow=6): 2026-06-06 23:59 IDT → 2026-06-06T20:59:00.000Z', () => {
    // 2026-06-07 − 7 + 6 = 2026-06-06 (Saturday)
    const d = deadlineDateTime('2026-06-07', 6, '23:59', 'Asia/Jerusalem')
    expect(d.toISOString()).toBe('2026-06-06T20:59:00.000Z')
  })
})

describe('isPastDeadline (timezone-correct)', () => {
  // Summer fixture: deadline = 2026-06-04T15:00:00.000Z
  const weekStart = '2026-06-07'
  const dow = 4
  const time = '18:00'
  const tz = 'Asia/Jerusalem'

  it('returns true when now is after the UTC deadline', () => {
    // 2026-06-04T15:01:00Z — one minute after
    const now = new Date('2026-06-04T15:01:00.000Z')
    expect(isPastDeadline(now, weekStart, dow, time, tz)).toBe(true)
  })

  it('returns false when now is before the UTC deadline', () => {
    // 2026-06-04T14:59:00Z — one minute before
    const now = new Date('2026-06-04T14:59:00.000Z')
    expect(isPastDeadline(now, weekStart, dow, time, tz)).toBe(false)
  })

  it('returns false when now is exactly at the deadline', () => {
    const now = new Date('2026-06-04T15:00:00.000Z')
    expect(isPastDeadline(now, weekStart, dow, time, tz)).toBe(false)
  })

  it('returns true one second after the deadline', () => {
    const now = new Date('2026-06-04T15:00:01.000Z')
    expect(isPastDeadline(now, weekStart, dow, time, tz)).toBe(true)
  })

  it('default tz (Asia/Jerusalem) works without explicit param', () => {
    // deadline for summer fixture = 2026-06-04T15:00:00.000Z
    const afterDeadline = new Date('2026-06-04T16:00:00.000Z')
    expect(isPastDeadline(afterDeadline, weekStart, dow, time)).toBe(true)
  })
})
