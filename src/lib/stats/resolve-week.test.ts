// The dashboard's unanchored ("נוכחי") week must be the CALENDAR current week,
// not the latest published one — managers publish next week mid-week, and the
// old latest-published rule made the dashboard jump to a future week.
import { describe, it, expect } from 'vitest'
import { resolveCurrentWeekStart } from './resolve-week'

describe('resolveCurrentWeekStart', () => {
  it('picks the published week containing today, even when next week is already published', () => {
    // Sat 2026-08-22 → current week starts Sun 2026-08-16
    expect(
      resolveCurrentWeekStart(['2026-08-23', '2026-08-16', '2026-08-09'], '2026-08-22'),
    ).toBe('2026-08-16')
  })

  it('falls back to the most recent past week when the current week is unpublished', () => {
    expect(
      resolveCurrentWeekStart(['2026-08-23', '2026-08-09', '2026-08-02'], '2026-08-19'),
    ).toBe('2026-08-09')
  })

  it('falls back to the EARLIEST future week when only future weeks are published', () => {
    expect(
      resolveCurrentWeekStart(['2026-09-06', '2026-08-30'], '2026-08-22'),
    ).toBe('2026-08-30')
  })

  it('returns null when nothing is published', () => {
    expect(resolveCurrentWeekStart([], '2026-08-22')).toBeNull()
  })

  it('on Sunday the week that begins today counts as the current week', () => {
    expect(
      resolveCurrentWeekStart(['2026-08-30', '2026-08-23'], '2026-08-23'),
    ).toBe('2026-08-23')
  })

  it('does not assume input order', () => {
    expect(
      resolveCurrentWeekStart(['2026-08-09', '2026-08-23', '2026-08-16'], '2026-08-22'),
    ).toBe('2026-08-16')
  })
})
