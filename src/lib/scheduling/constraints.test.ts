import { describe, it, expect } from 'vitest'
import {
  availabilityAllows,
  holdsRole,
  isAssignable,
  restSatisfied,
  underMax,
  worksThatDay,
} from './constraints'
import { shabbatBlocks, holidayBlocks, isSacredBlocked } from './shabbat-holiday'
import { gapHours, restOk, shiftEndAbs, shiftStartAbs } from './rest'
import { emp, GUARD, settings } from './fixtures'
import type { Assignment, DayMeta } from './types'

const meta = (index: number, o: Partial<DayMeta> = {}): DayMeta => ({
  index,
  isHolidayEve: false,
  isHoliday: false,
  ...o,
})

describe('rest math', () => {
  it('night 23:00 + 8h crosses midnight (end at next day 07:00)', () => {
    expect(shiftStartAbs(0, 'night')).toBe(23)
    expect(shiftEndAbs(0, 'night')).toBe(31) // 0*24 + 23 + 8
  })
  it('night→next-morning is 0h gap (back-to-back) → rest NOT ok at 8h', () => {
    // night day0 ends abs 31; morning day1 starts abs 31.
    expect(gapHours(0, 'night', 1, 'morning')).toBe(0)
    expect(restOk(0, 'night', 1, 'morning', 8)).toBe(false)
  })
  it('morning→noon same day: noon starts at end of morning → 0h gap, not ok', () => {
    expect(gapHours(0, 'morning', 0, 'noon')).toBe(0)
  })
  it('night day0 → noon day1 has 8h gap → ok', () => {
    // night ends abs31, noon day1 starts 24+15=39 → 8h gap
    expect(gapHours(0, 'night', 1, 'noon')).toBe(8)
    expect(restOk(0, 'night', 1, 'noon', 8)).toBe(true)
  })
  it('overlap returns -1', () => {
    expect(gapHours(0, 'morning', 0, 'morning')).toBe(-1)
  })
})

describe('hard constraints', () => {
  it('1. role match', () => {
    expect(holdsRole(emp('a', { roleIds: [GUARD] }), GUARD)).toBe(true)
    expect(holdsRole(emp('a', { roleIds: [GUARD] }), 'מוקדן')).toBe(false)
  })
  it('3. availability null = unrestricted; profile restricts', () => {
    expect(availabilityAllows(emp('a'), 0, 'morning')).toBe(true)
    const nightsOnly = emp('a', { availability: { 0: ['night'], 1: ['night'] } })
    expect(availabilityAllows(nightsOnly, 0, 'night')).toBe(true)
    expect(availabilityAllows(nightsOnly, 0, 'morning')).toBe(false)
    expect(availabilityAllows(nightsOnly, 2, 'night')).toBe(false) // no entry for day2
  })
  it('7. one shift per day', () => {
    const cur: Assignment[] = [{ employeeId: 'a', day: 3, shift: 'morning', roleId: GUARD }]
    expect(worksThatDay(cur, 3)).toBe(true)
    expect(worksThatDay(cur, 4)).toBe(false)
  })
  it('8. maxShifts', () => {
    const cur: Assignment[] = [
      { employeeId: 'a', day: 0, shift: 'morning', roleId: GUARD },
      { employeeId: 'a', day: 1, shift: 'morning', roleId: GUARD },
    ]
    expect(underMax(emp('a', { maxShifts: 2 }), cur)).toBe(false)
    expect(underMax(emp('a', { maxShifts: 3 }), cur)).toBe(true)
    expect(underMax(emp('a', { maxShifts: null }), cur)).toBe(true)
  })
  it('6. rest violation blocks (night→next morning)', () => {
    const cur: Assignment[] = [{ employeeId: 'a', day: 0, shift: 'night', roleId: GUARD }]
    expect(
      restSatisfied({
        emp: emp('a'),
        meta: meta(1),
        shift: 'morning',
        roleId: GUARD,
        request: { off: false, preferred: [] },
        current: cur,
        settings: settings(),
      }),
    ).toBe(false)
  })
})

describe('shabbat & holiday blocks', () => {
  it('4. shabbat: Fri noon+night blocked, Sat morning+noon blocked, Sat night allowed', () => {
    expect(shabbatBlocks(5, 'morning')).toBe(false)
    expect(shabbatBlocks(5, 'noon')).toBe(true)
    expect(shabbatBlocks(5, 'night')).toBe(true)
    expect(shabbatBlocks(6, 'morning')).toBe(true)
    expect(shabbatBlocks(6, 'noon')).toBe(true)
    expect(shabbatBlocks(6, 'night')).toBe(false) // 23:00 ALLOWED
  })
  it('5. holiday eve blocks noon+night; holiday day blocks morning+noon', () => {
    expect(holidayBlocks(meta(2, { isHolidayEve: true }), 'morning')).toBe(false)
    expect(holidayBlocks(meta(2, { isHolidayEve: true }), 'noon')).toBe(true)
    expect(holidayBlocks(meta(2, { isHolidayEve: true }), 'night')).toBe(true)
    expect(holidayBlocks(meta(3, { isHoliday: true }), 'morning')).toBe(true)
    expect(holidayBlocks(meta(3, { isHoliday: true }), 'noon')).toBe(true)
    expect(holidayBlocks(meta(3, { isHoliday: true }), 'night')).toBe(false)
  })
  it('observer flags gate the blocks', () => {
    const obs = emp('a', { observesShabbat: true })
    const non = emp('b', { observesShabbat: false })
    expect(isSacredBlocked(obs, meta(5), 'night')).toBe(true)
    expect(isSacredBlocked(non, meta(5), 'night')).toBe(false)
    expect(isSacredBlocked(obs, meta(6), 'night')).toBe(false) // Sat night ok
  })
})

describe('cross-week rest (priorTail)', () => {
  // current week day 0 = abs hour 0; prior Sat night ends at abs 7 (= Sun morning start)
  const baseCtx = {
    emp: emp('a'),
    meta: meta(0),
    shift: 'morning' as const,
    roleId: GUARD,
    request: { off: false, preferred: [] },
    current: [] as Assignment[],
    settings: settings(),
  }
  it('blocks Sun morning when prior Sat night ended at abs 7 (gap 0)', () => {
    expect(restSatisfied({ ...baseCtx, priorTail: [7] })).toBe(false)
  })
  it('does not block Sun noon (start abs 15, gap 8 satisfies default 8h)', () => {
    expect(restSatisfied({ ...baseCtx, shift: 'noon', priorTail: [7] })).toBe(true)
  })
  it('does not block Sun morning when prior shift ended >= 8h ago (abs -1)', () => {
    // Prior Sat noon 15-23 → end abs (-1*24)+15+8 = -1. Sun morning starts at 7. Gap = 8.
    expect(restSatisfied({ ...baseCtx, priorTail: [-1] })).toBe(true)
  })
  it('blocks Sun morning when prior Sat m12_15to3 ended at abs 3 (gap 4)', () => {
    expect(restSatisfied({ ...baseCtx, priorTail: [3] })).toBe(false)
  })
  it('absent or empty priorTail is a no-op', () => {
    expect(restSatisfied({ ...baseCtx })).toBe(true)
    expect(restSatisfied({ ...baseCtx, priorTail: [] })).toBe(true)
  })
})

describe('isAssignable integration', () => {
  const base = {
    meta: meta(0),
    shift: 'morning' as const,
    roleId: GUARD,
    request: { off: false, preferred: [] },
    current: [] as Assignment[],
    settings: settings(),
  }
  it('off → not assignable', () => {
    expect(isAssignable({ ...base, emp: emp('a'), request: { off: true, preferred: [] } })).toBe(false)
  })
  it('legal candidate assignable', () => {
    expect(isAssignable({ ...base, emp: emp('a') })).toBe(true)
  })
})
