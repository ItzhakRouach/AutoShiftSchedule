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
