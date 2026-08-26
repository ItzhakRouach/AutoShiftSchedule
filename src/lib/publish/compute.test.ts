import { describe, it, expect } from 'vitest'
import { isPublishDue } from './compute'

/**
 * Fixtures (Israel tz = Asia/Jerusalem, UTC+3 in summer, UTC+2 in winter):
 *
 * Summer fixture (IDT = UTC+3):
 *   now = 2026-06-07T06:00:00Z → 2026-06-07 09:00 IDT (Sunday)
 *   publishDow = 0 (Sunday), publishTime = '09:00' → due
 *
 * Winter fixture (IST = UTC+2):
 *   now = 2026-01-09T08:00:00Z → 2026-01-09 10:00 IST (Friday)
 *   publishDow = 5 (Friday), publishTime = '10:00' → due
 */

const TZ = 'Asia/Jerusalem'

describe('isPublishDue', () => {
  it('returns true: Sunday summer, time matches exactly', () => {
    // 2026-06-07 is a Sunday; 06:00 UTC = 09:00 IDT
    const now = new Date('2026-06-07T06:00:00.000Z')
    expect(isPublishDue(now, 0, '09:00', TZ)).toBe(true)
  })

  it('returns true: time is past the publish threshold', () => {
    // 07:00 UTC = 10:00 IDT > 09:00
    const now = new Date('2026-06-07T07:00:00.000Z')
    expect(isPublishDue(now, 0, '09:00', TZ)).toBe(true)
  })

  it('returns false: correct day but too early', () => {
    // 05:00 UTC = 08:00 IDT < 09:00
    const now = new Date('2026-06-07T05:00:00.000Z')
    expect(isPublishDue(now, 0, '09:00', TZ)).toBe(false)
  })

  it('returns false: wrong day of week', () => {
    // 2026-06-08 is Monday, publishDow=0 (Sunday)
    const now = new Date('2026-06-08T06:00:00.000Z')
    expect(isPublishDue(now, 0, '09:00', TZ)).toBe(false)
  })

  it('returns true: winter Friday, time matches (UTC+2)', () => {
    // 2026-01-09 is a Friday; 08:00 UTC = 10:00 IST
    const now = new Date('2026-01-09T08:00:00.000Z')
    expect(isPublishDue(now, 5, '10:00', TZ)).toBe(true)
  })

  it('returns false: winter Friday, time is before publish time', () => {
    // 07:59 UTC = 09:59 IST < 10:00
    const now = new Date('2026-01-09T07:59:00.000Z')
    expect(isPublishDue(now, 5, '10:00', TZ)).toBe(false)
  })

  it('returns true: Saturday (dow=6) in Israel tz', () => {
    // 2026-06-13 is a Saturday; 05:00 UTC = 08:00 IDT, publish at 08:00
    const now = new Date('2026-06-13T05:00:00.000Z')
    expect(isPublishDue(now, 6, '08:00', TZ)).toBe(true)
  })

  it('uses default tz (Asia/Jerusalem) when not provided', () => {
    const now = new Date('2026-06-07T06:00:00.000Z')
    expect(isPublishDue(now, 0, '09:00')).toBe(true)
  })
})

describe('autoPublishWindow', () => {
  it('caps maxWeek at the upcoming Sunday — a manager-published current week must not let the cron publish next week early', async () => {
    const { autoPublishWindow } = await import('./compute')
    // The 21.8 regression: Friday 2026-08-21 08:13 IDT (05:13 UTC). Week 23.8
    // was already manually published, and the cron reached into the 30.8 draft.
    const now = new Date('2026-08-21T05:13:44.917Z')
    const { minWeek, maxWeek } = autoPublishWindow(now)
    expect(maxWeek).toBe('2026-08-23') // NOT 2026-08-30
    expect(minWeek).toBe('2026-08-07') // 14-day retro guard
  })

  it('on Sunday itself the same-day week is still publishable', async () => {
    const { autoPublishWindow } = await import('./compute')
    // Sunday 2026-08-23 09:00 IDT (06:00 UTC) → the week starting today.
    const { maxWeek } = autoPublishWindow(new Date('2026-08-23T06:00:00Z'))
    expect(maxWeek).toBe('2026-08-23')
  })

  it('uses the Israel wall clock at the UTC/Israel date boundary', async () => {
    const { autoPublishWindow } = await import('./compute')
    // Saturday 2026-08-22 21:30 UTC is ALREADY Sunday 00:30 IDT → the week
    // starting 23.8, not 30.8.
    const { maxWeek } = autoPublishWindow(new Date('2026-08-22T21:30:00Z'))
    expect(maxWeek).toBe('2026-08-23')
  })
})
