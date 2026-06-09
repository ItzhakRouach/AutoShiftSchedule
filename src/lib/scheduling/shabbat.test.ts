import { describe, it, expect } from 'vitest'
import { isSacredBlocked } from './shabbat-holiday'
import type { DayMeta, Employee, ShiftKey } from './types'

const observer: Employee = {
  id: 'o',
  roleIds: ['מאבטח'],
  employmentType: 'full',
  minShifts: 0,
  maxShifts: null,
  observesShabbat: true,
  observesHolidays: true,
  mustAccept: false,
  availability: null,
}
const meta = (index: number): DayMeta => ({ index, isHolidayEve: false, isHoliday: false })

// Shabbat window = Fri ~16:00 → Sat ~20:00 (motzash).
describe('Shabbat blocking window (Fri 16:00 → Sat 20:00)', () => {
  const cases: [string, number, ShiftKey, boolean][] = [
    ['Fri morning (07–15) allowed', 5, 'morning', false],
    ['Fri noon (15–23) blocked', 5, 'noon', true],
    ['Fri night (23–07) blocked', 5, 'night', true],
    ['Sat morning (07–15) blocked', 6, 'morning', true],
    ['Sat noon (15–23) blocked', 6, 'noon', true],
    ['Sat night (23–07) allowed (motzash)', 6, 'night', false],
    ['Sun morning allowed', 0, 'morning', false],
  ]
  for (const [label, day, shift, blocked] of cases) {
    it(label, () => {
      expect(isSacredBlocked(observer, meta(day), shift)).toBe(blocked)
    })
  }

  it('non-observer is never Shabbat-blocked', () => {
    const free: Employee = { ...observer, observesShabbat: false, observesHolidays: false }
    expect(isSacredBlocked(free, meta(6), 'morning')).toBe(false)
    expect(isSacredBlocked(free, meta(5), 'night')).toBe(false)
  })
})
