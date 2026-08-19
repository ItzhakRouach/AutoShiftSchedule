import { describe, it, expect } from 'vitest'
import { isHardDay, prioritizeDays } from './day-order'
import { plainWeek } from './fixtures'

describe('isHardDay', () => {
  it('Friday (5) and Saturday (6) are hard; Sun–Thu are not', () => {
    const week = plainWeek()
    expect(week.map(isHardDay)).toEqual([false, false, false, false, false, true, true])
  })

  it('holiday and holiday-eve days are hard regardless of index', () => {
    expect(isHardDay({ index: 2, isHoliday: true, isHolidayEve: false })).toBe(true)
    expect(isHardDay({ index: 1, isHoliday: false, isHolidayEve: true })).toBe(true)
  })
})

describe('prioritizeDays', () => {
  it('plain week → Fri, Sat, then Sun–Thu chronologically', () => {
    expect(prioritizeDays(plainWeek()).map((d) => d.index)).toEqual([5, 6, 0, 1, 2, 3, 4])
  })

  it('mid-week holiday joins the priority group, chronological within groups', () => {
    const week = plainWeek([{}, {}, { isHoliday: true }])
    expect(prioritizeDays(week).map((d) => d.index)).toEqual([2, 5, 6, 0, 1, 3, 4])
  })

  it('holiday-eve joins the priority group', () => {
    const week = plainWeek([{}, { isHolidayEve: true }])
    expect(prioritizeDays(week).map((d) => d.index)).toEqual([1, 5, 6, 0, 2, 3, 4])
  })

  it('does not mutate the input array', () => {
    const week = plainWeek()
    prioritizeDays(week)
    expect(week.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
