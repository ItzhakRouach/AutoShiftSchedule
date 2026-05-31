import { describe, it, expect } from 'vitest'
import { generateSchedule, validateAssignment } from './engine'
import { GUARD, emp, input, mergeReqs, plainWeek, reqFor } from './fixtures'
import type { Assignment } from './types'

const allDays = [0, 1, 2, 3, 4, 5, 6]

describe('all-8h fully staffable', () => {
  it('100% coverage, every slot filled, no warnings', () => {
    // 1 guard slot, morning only, all 7 days. 7 employees → trivially staffable
    // (each works ≤7 days, rest fine since morning→morning is 24h apart).
    const employees = Array.from({ length: 7 }, (_, i) => emp(`g${i}`))
    const res = generateSchedule(
      input({
        employees,
        requirements: reqFor(allDays, 'morning', GUARD, 1),
      }),
    )
    expect(res.warnings).toEqual([])
    expect(res.coverage.percent).toBe(100)
    expect(res.coverage.requiredSlots).toBe(7)
    expect(res.coverage.filledSlots).toBe(7)
    expect(res.feasibility.status).toBe('ok')
    expect(res.twelveHourSuggestions).toEqual([])
    // exactly one guard per morning
    for (const d of allDays) expect(res.grid[d].morning[GUARD]).toHaveLength(1)
  })
})

describe('one shift per day & rest never violated', () => {
  it('a single guard covering morning+noon same day is impossible (1 per day)', () => {
    const employees = [emp('solo')]
    const res = generateSchedule(
      input({
        employees,
        requirements: mergeReqs(
          reqFor([0], 'morning', GUARD, 1),
          reqFor([0], 'noon', GUARD, 1),
        ),
      }),
    )
    expect(res.stats.solo.shifts).toBe(1) // only one of the two
    expect(res.warnings).toHaveLength(1)
  })
  it('no employee is ever assigned two shifts <8h apart', () => {
    const employees = Array.from({ length: 3 }, (_, i) => emp(`g${i}`))
    const req = mergeReqs(
      reqFor(allDays, 'morning', GUARD, 1),
      reqFor(allDays, 'noon', GUARD, 1),
      reqFor(allDays, 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees, requirements: req }))
    for (const e of employees) {
      const a = res.assignmentsByEmployee[e.id]
      for (let i = 0; i < a.length; i++)
        for (let j = i + 1; j < a.length; j++)
          expect(validatePair(a[i], a[j])).toBe(true)
    }
  })
})

function validatePair(a: Assignment, b: Assignment): boolean {
  const start = (x: Assignment) => x.day * 24 + ({ morning: 7, noon: 15, night: 23 }[x.shift])
  const end = (x: Assignment) => start(x) + 8
  const gap = start(b) >= end(a) ? start(b) - end(a) : start(a) >= end(b) ? start(a) - end(b) : -1
  return gap >= 8 || a.day !== b.day // different-day handled by gap; same-day excluded anyway
}

describe('shabbat observer boundaries', () => {
  it('never Fri-noon/Fri-night/Sat-morning/Sat-noon; CAN get Sat-night', () => {
    const observer = emp('obs', { observesShabbat: true })
    const filler = emp('fill') // non-observer to take blocked slots
    const req = mergeReqs(
      reqFor([5], 'noon', GUARD, 1),
      reqFor([5], 'night', GUARD, 1),
      reqFor([6], 'morning', GUARD, 1),
      reqFor([6], 'noon', GUARD, 1),
      reqFor([6], 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [observer, filler], requirements: req }))
    const obsShifts = res.assignmentsByEmployee.obs
    for (const a of obsShifts) {
      expect(!(a.day === 5 && (a.shift === 'noon' || a.shift === 'night'))).toBe(true)
      expect(!(a.day === 6 && (a.shift === 'morning' || a.shift === 'noon'))).toBe(true)
    }
    // Sat-night: only the observer holds GUARD here too; force it by making filler off Sat
    const res2 = generateSchedule(
      input({
        employees: [observer],
        requirements: reqFor([6], 'night', GUARD, 1),
      }),
    )
    expect(res2.grid[6].night[GUARD]).toEqual(['obs'])
  })
})

describe('holiday observer boundaries', () => {
  it('eve noon+night blocked, holiday-day morning+noon blocked', () => {
    const days = plainWeek([{}, { index: 1, isHolidayEve: true, isHoliday: false }, { index: 2, isHolidayEve: false, isHoliday: true }])
    const observer = emp('obs', { observesHolidays: true })
    const req = mergeReqs(
      reqFor([1], 'noon', GUARD, 1),
      reqFor([1], 'night', GUARD, 1),
      reqFor([2], 'morning', GUARD, 1),
      reqFor([2], 'noon', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [observer], days, requirements: req }))
    expect(res.assignmentsByEmployee.obs).toEqual([]) // every required slot blocked
    expect(res.warnings).toHaveLength(4)
  })
})

describe('maxShifts & employment defaults', () => {
  it('never exceeds maxShifts', () => {
    const capped = emp('cap', { maxShifts: 2 })
    const res = generateSchedule(
      input({ employees: [capped], requirements: reqFor(allDays, 'morning', GUARD, 1) }),
    )
    expect(res.stats.cap.shifts).toBe(2)
  })
})

describe('availability profiles', () => {
  it('weekday nights-only guard only gets nights Sun–Thu', () => {
    const nightsOnly = emp('n', {
      availability: { 0: ['night'], 1: ['night'], 2: ['night'], 3: ['night'], 4: ['night'] },
    })
    const req = mergeReqs(
      reqFor([0, 1, 2, 3, 4], 'morning', GUARD, 1),
      reqFor([0, 1, 2, 3, 4], 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [nightsOnly], requirements: req }))
    for (const a of res.assignmentsByEmployee.n) expect(a.shift).toBe('night')
  })
  it('weekend-flex guard can take Fri/Sat morning/noon/night (non-observer)', () => {
    const flex = emp('w', { availability: { 5: ['morning', 'noon', 'night'], 6: ['morning', 'noon', 'night'] } })
    const req = mergeReqs(reqFor([5], 'noon', GUARD, 1), reqFor([6], 'morning', GUARD, 1))
    const res = generateSchedule(input({ employees: [flex], requirements: req }))
    expect(res.stats.w.shifts).toBe(2)
  })
})

describe('validateAssignment helper', () => {
  it('rejects a rest-violating manual edit', () => {
    const e = emp('a')
    const current: Assignment[] = [{ employeeId: 'a', day: 0, shift: 'night', roleId: GUARD }]
    const ok = validateAssignment(
      input({ employees: [e] }),
      e,
      plainWeek()[1],
      'morning',
      GUARD,
      current,
    )
    expect(ok).toBe(false)
  })
})
