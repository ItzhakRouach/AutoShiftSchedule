import { describe, it, expect } from 'vitest'
import { kippurOverlapHours, kippurWindowsForWeek, withoutKippurDates } from './kippur-hours'
import type { KippurWindow } from '@/lib/holidays/yom-kippur'

/** A synthetic window — these tests are about interval math, not the calendar. */
const W: KippurWindow = {
  date: '2026-09-21',
  startMs: Date.parse('2026-09-20T15:22:00.000Z'),
  endMs: Date.parse('2026-09-21T16:15:00.000Z'),
}
const WINDOWS = [W]

const at = (iso: string) => iso
const hoursFrom = (startISO: string, endISO: string) => kippurOverlapHours(startISO, endISO, WINDOWS)

describe('kippurOverlapHours', () => {
  it('a shift entirely inside counts its whole length', () => {
    expect(hoursFrom(at('2026-09-21T04:00:00.000Z'), at('2026-09-21T12:00:00.000Z'))).toBe(8)
  })

  it('a shift entirely before the window counts nothing', () => {
    expect(hoursFrom(at('2026-09-20T04:00:00.000Z'), at('2026-09-20T12:00:00.000Z'))).toBe(0)
  })

  it('a shift entirely after the window counts nothing', () => {
    expect(hoursFrom(at('2026-09-21T20:00:00.000Z'), at('2026-09-22T04:00:00.000Z'))).toBe(0)
  })

  it('a shift crossing the start counts only from candle lighting', () => {
    // 15:00–23:00 IDT on erev; the fast starts 18:22 → 4h38m = 4.63.
    expect(hoursFrom(at('2026-09-20T12:00:00.000Z'), at('2026-09-20T20:00:00.000Z'))).toBe(4.63)
  })

  it('a shift crossing the end counts only up to havdalah', () => {
    // 15:00–23:00 IDT on Yom Kippur; the fast ends 19:15 → exactly 4.25.
    expect(hoursFrom(at('2026-09-21T12:00:00.000Z'), at('2026-09-21T20:00:00.000Z'))).toBe(4.25)
  })

  it('a shift containing the whole window counts the window, not the shift', () => {
    const hours = kippurOverlapHours('2026-09-20T00:00:00.000Z', '2026-09-22T00:00:00.000Z', WINDOWS)
    expect(hours).toBe(Math.round(((W.endMs - W.startMs) / 3_600_000) * 100) / 100)
  })

  it('touching the boundary exactly counts nothing — the interval is half-open', () => {
    expect(kippurOverlapHours('2026-09-20T07:22:00.000Z', '2026-09-20T15:22:00.000Z', WINDOWS)).toBe(0)
  })

  it('no windows, or an unparsable instant, counts nothing', () => {
    expect(kippurOverlapHours('2026-09-21T04:00:00.000Z', '2026-09-21T12:00:00.000Z', [])).toBe(0)
    expect(hoursFrom('not-a-date', '2026-09-21T12:00:00.000Z')).toBe(0)
    expect(hoursFrom('2026-09-21T12:00:00.000Z', '2026-09-21T04:00:00.000Z')).toBe(0)
  })
})

describe('withoutKippurDates', () => {
  it('drops Yom Kippur and its eve so the civil date stops driving holiday pay', () => {
    const set = new Set(['2026-09-20', '2026-09-21', '2026-10-05'])
    const out = withoutKippurDates(set, WINDOWS)
    expect(out.has('2026-09-21')).toBe(false)
    expect(out.has('2026-09-20')).toBe(false)
    expect(out.has('2026-10-05')).toBe(true)
  })

  it('leaves the set untouched when the week holds no Kippur window', () => {
    const set = new Set(['2026-10-05'])
    expect([...withoutKippurDates(set, [])]).toEqual(['2026-10-05'])
  })

  it('does not mutate the input set', () => {
    const set = new Set(['2026-09-21'])
    withoutKippurDates(set, WINDOWS)
    expect(set.has('2026-09-21')).toBe(true)
  })
})

describe('kippurWindowsForWeek', () => {
  it('finds the window for a week that contains Yom Kippur', () => {
    const windows = kippurWindowsForWeek('2026-09-20')
    expect(windows).toHaveLength(1)
    expect(windows[0].date).toBe('2026-09-21')
  })

  it('still returns the window — callers filter by overlap, not by week', () => {
    // Every week of the year resolves its year's window; only the per-shift
    // overlap decides anything, so an ordinary week simply never overlaps.
    const windows = kippurWindowsForWeek('2026-07-19')
    expect(windows.every((w) => w.date === '2026-09-21')).toBe(true)
    expect(kippurOverlapHours('2026-07-19T04:00:00.000Z', '2026-07-19T12:00:00.000Z', windows)).toBe(0)
  })

  it('a week spanning a year boundary resolves both years', () => {
    const windows = kippurWindowsForWeek('2026-12-27')
    expect(windows.map((w) => w.date)).toEqual(['2026-09-21', '2027-10-11'])
  })
})
