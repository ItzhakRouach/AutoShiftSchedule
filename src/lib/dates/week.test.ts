import { describe, it, expect } from 'vitest'
import { upcomingWeekStartISO, formatHebDate, hebrewDayName, isInVacationRange } from './week'

describe('upcomingWeekStartISO', () => {
  it('returns the same Sunday when today IS Sunday', () => {
    // 2026-06-07 is a Sunday
    const result = upcomingWeekStartISO(new Date(2026, 5, 7))
    expect(result).toBe('2026-06-07')
  })

  it('returns the NEXT Sunday when today is a Wednesday', () => {
    // 2026-06-03 is a Wednesday → next Sunday is 2026-06-07
    const result = upcomingWeekStartISO(new Date(2026, 5, 3))
    expect(result).toBe('2026-06-07')
  })

  it('returns the NEXT Sunday when today is Saturday', () => {
    // 2026-06-06 is a Saturday → next Sunday is 2026-06-07
    const result = upcomingWeekStartISO(new Date(2026, 5, 6))
    expect(result).toBe('2026-06-07')
  })

  it('returns the NEXT Sunday when today is Monday', () => {
    // 2026-06-01 is a Monday → next Sunday is 2026-06-07
    const result = upcomingWeekStartISO(new Date(2026, 5, 1))
    expect(result).toBe('2026-06-07')
  })

  it('formats as YYYY-MM-DD with zero-padding', () => {
    // 2026-01-04 is a Sunday
    const result = upcomingWeekStartISO(new Date(2026, 0, 4))
    expect(result).toBe('2026-01-04')
  })
})

describe('formatHebDate', () => {
  it('formats 2026-05-31 as "31.5"', () => {
    expect(formatHebDate('2026-05-31')).toBe('31.5')
  })

  it('formats 2026-01-04 as "4.1"', () => {
    expect(formatHebDate('2026-01-04')).toBe('4.1')
  })

  it('formats 2026-12-25 as "25.12"', () => {
    expect(formatHebDate('2026-12-25')).toBe('25.12')
  })
})

describe('hebrewDayName', () => {
  it('returns ראשון for a Sunday', () => {
    expect(hebrewDayName('2026-06-07')).toBe('ראשון')
  })
  it('returns שבת for a Saturday', () => {
    expect(hebrewDayName('2026-06-06')).toBe('שבת')
  })
  it('returns רביעי for a Wednesday', () => {
    expect(hebrewDayName('2026-06-03')).toBe('רביעי')
  })
})

describe('isInVacationRange', () => {
  const ranges = [
    { date_from: '2026-06-10', date_to: '2026-06-15' },
    { date_from: '2026-07-01', date_to: '2026-07-01' },
  ]
  it('matches the first day of a range (inclusive)', () => {
    expect(isInVacationRange('2026-06-10', ranges)).toBe(true)
  })
  it('matches the last day of a range (inclusive)', () => {
    expect(isInVacationRange('2026-06-15', ranges)).toBe(true)
  })
  it('matches a single-day range', () => {
    expect(isInVacationRange('2026-07-01', ranges)).toBe(true)
  })
  it('rejects dates outside any range', () => {
    expect(isInVacationRange('2026-06-09', ranges)).toBe(false)
    expect(isInVacationRange('2026-06-16', ranges)).toBe(false)
  })
  it('empty ranges → always false', () => {
    expect(isInVacationRange('2026-06-10', [])).toBe(false)
  })
})
