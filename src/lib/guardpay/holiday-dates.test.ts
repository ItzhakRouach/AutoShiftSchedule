import { describe, it, expect } from 'vitest'
import { unionHolidaySet, weekYears } from './holiday-dates'
import { israeliChagDates } from '@/lib/holidays/israel'

describe('unionHolidaySet', () => {
  it('contains every workplace-table date', () => {
    const set = unionHolidaySet(['2026-07-20', '2026-07-24'], [2026])
    expect(set.has('2026-07-20')).toBe(true)
    expect(set.has('2026-07-24')).toBe(true)
  })

  it('contains every hebcal chag date for the given years', () => {
    const set = unionHolidaySet([], [2026])
    const chagim = israeliChagDates(2026)
    expect(chagim.length).toBeGreaterThan(0)
    for (const c of chagim) expect(set.has(c.date)).toBe(true)
  })

  it('does not invent dates', () => {
    const set = unionHolidaySet([], [2026])
    expect(set.has('2026-07-22')).toBe(false) // ordinary Wednesday
  })
})

describe('weekYears', () => {
  it('single year for a mid-year week', () => {
    expect(weekYears('2026-07-19')).toEqual([2026])
  })
  it('both years when the week crosses new year (covers weekStart..+7)', () => {
    expect(weekYears('2026-12-27')).toEqual([2026, 2027])
  })
})
