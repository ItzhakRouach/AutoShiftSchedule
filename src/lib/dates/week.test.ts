import { describe, it, expect } from 'vitest'
import {
  upcomingWeekStartISO,
  upcomingWeekStartFromISO,
  formatHebDate,
  hebrewDayName,
  isInVacationRange,
  resolveAbsenceKind,
  addDaysISO,
  shouldRollToNextWeek,
  todayInIsraelISO,
} from './week'

describe('todayInIsraelISO', () => {
  it('returns the Israel-wall-clock date, not the UTC date (server runs UTC)', () => {
    // 21:30 UTC on Aug 22 is already 00:30 Aug 23 in Israel (IDT, UTC+3)
    expect(todayInIsraelISO(new Date('2026-08-22T21:30:00Z'))).toBe('2026-08-23')
  })

  it('matches the UTC date while both are on the same day', () => {
    expect(todayInIsraelISO(new Date('2026-08-22T12:00:00Z'))).toBe('2026-08-22')
  })

  it('handles winter time (IST, UTC+2)', () => {
    expect(todayInIsraelISO(new Date('2026-01-10T22:30:00Z'))).toBe('2026-01-11')
    expect(todayInIsraelISO(new Date('2026-01-10T21:30:00Z'))).toBe('2026-01-10')
  })
})

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

describe('upcomingWeekStartFromISO', () => {
  it('returns the same Sunday when today IS Sunday', () => {
    expect(upcomingWeekStartFromISO('2026-06-07')).toBe('2026-06-07')
  })

  it('returns the NEXT Sunday when today is a Wednesday', () => {
    expect(upcomingWeekStartFromISO('2026-06-03')).toBe('2026-06-07')
  })

  it('returns the NEXT Sunday when today is Saturday', () => {
    expect(upcomingWeekStartFromISO('2026-06-06')).toBe('2026-06-07')
  })

  it('rolls over a month boundary', () => {
    // 2026-06-29 is a Monday → next Sunday is 2026-07-05
    expect(upcomingWeekStartFromISO('2026-06-29')).toBe('2026-07-05')
  })

  it('rolls over a year boundary', () => {
    // 2026-12-28 is a Monday → next Sunday is 2027-01-03
    expect(upcomingWeekStartFromISO('2026-12-28')).toBe('2027-01-03')
  })

  it('agrees with upcomingWeekStartISO for a plain local date', () => {
    expect(upcomingWeekStartFromISO('2026-06-03')).toBe(upcomingWeekStartISO(new Date(2026, 5, 3)))
  })
})

describe('addDaysISO', () => {
  it('adds 7 days within a month', () => {
    expect(addDaysISO('2026-06-07', 7)).toBe('2026-06-14')
  })
  it('rolls over a month boundary', () => {
    expect(addDaysISO('2026-06-28', 7)).toBe('2026-07-05')
  })
  it('rolls over a year boundary', () => {
    expect(addDaysISO('2026-12-28', 7)).toBe('2027-01-04')
  })
})

describe('shouldRollToNextWeek', () => {
  const noDeadline = { published: false, deadlinePassed: false, hasDeadline: false }
  it('rolls forward when the week has already started (weekStart ≤ today)', () => {
    // Sunday: upcoming week == today → collect for the following week instead.
    expect(shouldRollToNextWeek('2026-06-07', '2026-06-07', noDeadline)).toBe(true)
  })
  describe('with a configured deadline — the deadline governs, publish is ignored', () => {
    it('rolls when the deadline has passed', () => {
      expect(shouldRollToNextWeek('2026-06-14', '2026-06-07', { published: false, deadlinePassed: true, hasDeadline: true })).toBe(true)
    })
    it('STAYS on a published week whose deadline has NOT passed (collect until the deadline)', () => {
      // A manager may publish before the deadline; employees keep collecting.
      expect(shouldRollToNextWeek('2026-06-14', '2026-06-07', { published: true, deadlinePassed: false, hasDeadline: true })).toBe(false)
    })
    it('stays on a future collecting week before its deadline', () => {
      expect(shouldRollToNextWeek('2026-06-14', '2026-06-07', { published: false, deadlinePassed: false, hasDeadline: true })).toBe(false)
    })
  })
  describe('without a deadline — publish status governs (legacy)', () => {
    it('rolls past a published week', () => {
      expect(shouldRollToNextWeek('2026-06-14', '2026-06-07', { published: true, deadlinePassed: false, hasDeadline: false })).toBe(true)
    })
    it('stays on a future unpublished week', () => {
      expect(shouldRollToNextWeek('2026-06-14', '2026-06-07', noDeadline)).toBe(false)
    })
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

describe('resolveAbsenceKind', () => {
  it('returns null when no range covers the date', () => {
    const ranges = [{ date_from: '2026-06-10', date_to: '2026-06-15', kind: 'vacation' as const }]
    expect(resolveAbsenceKind('2026-06-09', ranges)).toBeNull()
  })

  it('returns the covering range kind (vacation)', () => {
    const ranges = [{ date_from: '2026-06-10', date_to: '2026-06-15', kind: 'vacation' as const }]
    expect(resolveAbsenceKind('2026-06-12', ranges)).toBe('vacation')
  })

  it('returns the covering range kind (miluim) — this is the regression case: a', () => {
    const ranges = [{ date_from: '2026-06-10', date_to: '2026-06-15', kind: 'miluim' as const }]
    expect(resolveAbsenceKind('2026-06-12', ranges)).toBe('miluim')
  })

  it('returns the covering range kind (sick)', () => {
    const ranges = [{ date_from: '2026-06-10', date_to: '2026-06-15', kind: 'sick' as const }]
    expect(resolveAbsenceKind('2026-06-12', ranges)).toBe('sick')
  })

  it('when multiple ranges overlap a day, picks the one with the earliest date_from deterministically', () => {
    const ranges = [
      { date_from: '2026-06-05', date_to: '2026-06-20', kind: 'vacation' as const },
      { date_from: '2026-06-01', date_to: '2026-06-30', kind: 'miluim' as const },
    ]
    expect(resolveAbsenceKind('2026-06-12', ranges)).toBe('miluim')
  })

  it('empty ranges → null', () => {
    expect(resolveAbsenceKind('2026-06-10', [])).toBeNull()
  })
})
