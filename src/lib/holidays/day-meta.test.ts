import { describe, it, expect } from 'vitest'
import { buildHolidayMeta } from './day-meta'

const WEEK = [
  '2024-10-11', // d0 = eve of YK
  '2024-10-12', // d1 = Yom Kippur
  '2024-10-13', // d2 = regular
  '2024-10-14', // d3 = regular
  '2024-10-15', // d4 = regular
  '2024-10-16', // d5 = regular
  '2024-10-17', // d6 = Sukkot I
]
const HOLIDAYS = new Set(['2024-10-12', '2024-10-17'])

describe('buildHolidayMeta', () => {
  it('marks the holiday day itself as isHoliday', () => {
    const meta = buildHolidayMeta(WEEK, HOLIDAYS)
    expect(meta[1].isHoliday).toBe(true)  // 10-12 = YK
    expect(meta[6].isHoliday).toBe(true)  // 10-17 = Sukkot I
  })

  it('marks the day before a holiday as isHolidayEve', () => {
    const meta = buildHolidayMeta(WEEK, HOLIDAYS)
    expect(meta[0].isHolidayEve).toBe(true)  // 10-11 → next day 10-12 ∈ holidays
    expect(meta[5].isHolidayEve).toBe(true)  // 10-16 → next day 10-17 ∈ holidays
  })

  it('ordinary days have both false', () => {
    const meta = buildHolidayMeta(WEEK, HOLIDAYS)
    // 10-13: not holiday, and 10-14 not in set
    expect(meta[2].isHoliday).toBe(false)
    expect(meta[2].isHolidayEve).toBe(false)
  })

  it('a holiday day that is also eve of the next holiday', () => {
    // e.g. consecutive holidays
    const week = ['2024-10-03', '2024-10-04', '2024-10-05',
                  '2024-10-06', '2024-10-07', '2024-10-08', '2024-10-09']
    const holidays = new Set(['2024-10-03', '2024-10-04'])
    const meta = buildHolidayMeta(week, holidays)
    expect(meta[0].isHoliday).toBe(true)
    expect(meta[0].isHolidayEve).toBe(true)  // next day 10-04 is also holiday
    expect(meta[1].isHoliday).toBe(true)
    expect(meta[1].isHolidayEve).toBe(false) // 10-05 not in set
  })

  it('returns exactly 7 elements', () => {
    const meta = buildHolidayMeta(WEEK, new Set())
    expect(meta).toHaveLength(7)
  })

  it('empty holiday set → all false', () => {
    const meta = buildHolidayMeta(WEEK, new Set())
    expect(meta.every((m) => !m.isHoliday && !m.isHolidayEve)).toBe(true)
  })
})
