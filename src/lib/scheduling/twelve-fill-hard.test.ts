// Exhaustive 12h auto-coverage suite (part 2): hard constraints, determinism,
// coverage/feasibility consistency, residual gaps. EXACT assertions.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, emp, input, mergeReqs, plainWeek, reqFor, settings } from './fixtures'

const allDays = [0, 1, 2, 3, 4, 5, 6]
const on = () => settings({ allow12hFallback: true })

describe('12h respects HARD constraints', () => {
  it('one-per-day: a person with an 8h shift that day cannot also take a 12h', () => {
    // g already gets morning 8h on day0; the noon+night gap must NOT be filled by
    // g via 12h (worksThatDay). Another guard g2 fills it instead.
    const g = emp('g')
    const g2 = emp('g2')
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [g, g2], requirements: req, settings: on() }))
    // Each person at most one (day,) entry per day for 12h or one 8h.
    for (const id of ['g', 'g2']) {
      const days = res.assignmentsByEmployee[id].map((a) => a.day)
      const day0 = days.filter((x) => x === 0)
      // a 12h yields 2 same-day cells; an 8h yields 1. Never both an 8h AND a 12h.
      const has8h = res.assignmentsByEmployee[id].some((a) => a.day === 0 && !a.is12h)
      const has12h = res.assignmentsByEmployee[id].some((a) => a.day === 0 && a.is12h)
      expect(has8h && has12h).toBe(false)
      expect(day0.length).toBeGreaterThan(0)
    }
  })

  it('maxShifts: a 12h is NOT assigned when the person is already at max', () => {
    // g has max 1 and is used for morning 8h day0; cannot take a 12h elsewhere.
    const g = emp('g', { maxShifts: 1 })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([1], 'noon', GUARD, 1),
      reqFor([1], 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [g], requirements: req, settings: on() }))
    expect(res.assignmentsByEmployee.g.length).toBe(1) // only the 8h morning
    expect(res.warnings.length).toBeGreaterThan(0)
  })

  it('availability: a 12h is blocked when a TOUCHED window is not allowed', () => {
    // p available only morning on day0; m12_day touches morning+noon → noon not
    // allowed → blocked. So a noon gap cannot be 12h-filled by p.
    const p = emp('p', { availability: { 0: ['morning'] } })
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'noon', GUARD, 1))
    const res = generateSchedule(input({ employees: [p], requirements: req, settings: on() }))
    expect(res.twelveHourAssignments).toEqual([])
    // morning still filled by 8h; noon warns.
    expect(res.grid[0].morning[GUARD]).toEqual(['p'])
    expect(res.warnings.some((w) => w.shift === 'noon')).toBe(true)
  })

  it('Shabbat observer: 12h blocked when a covered window is sacred', () => {
    // Fri (day5): m12_day touches morning+noon; Fri noon is sacred-blocked for an
    // observer. So an observer cannot take m12_day Fri.
    const obs = emp('obs', { observesShabbat: true })
    const req = mergeReqs(reqFor([5], 'morning', GUARD, 1), reqFor([5], 'noon', GUARD, 1))
    const res = generateSchedule(input({ employees: [obs], requirements: req, days: plainWeek(), settings: on() }))
    expect(res.twelveHourAssignments).toEqual([])
  })

  it('rest: a 12h is blocked when it under-rests an adjacent committed shift', () => {
    // p works night 8h on day0 (23:00 day0 – 07:00 day1). m12_day on day1 starts
    // 07:00 day1 → gap 0 < 8 → blocked. So a day1 morning+noon gap is NOT filled.
    const p = emp('p')
    const req = mergeReqs(
      reqFor([0], 'night', GUARD, 1),
      reqFor([1], 'morning', GUARD, 1),
      reqFor([1], 'noon', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [p], requirements: req, settings: on() }))
    // day0 night filled 8h; day1 m12_day would violate rest → only the part
    // reachable remains; assert no m12_day on day1 for p.
    const p1 = res.twelveHourAssignments.filter((t) => t.day === 1 && t.variant === 'm12_day')
    expect(p1).toEqual([])
  })
})

describe('determinism', () => {
  it('same seed + input → identical 12h assignments', () => {
    const build = () => {
      const employees = [emp('g0'), emp('g1')]
      const req = mergeReqs(
        reqFor(allDays, 'morning', GUARD, 1),
        reqFor(allDays, 'noon', GUARD, 1),
        reqFor(allDays, 'night', GUARD, 1),
      )
      return generateSchedule(input({ employees, requirements: req, settings: on(), seed: 42 }))
    }
    expect(build().twelveHourAssignments).toEqual(build().twelveHourAssignments)
  })
})

describe('coverage / feasibility consistency', () => {
  it('filledSlots == maxStaffable; week coverable via 12h reports covered', () => {
    const employees = [emp('g0'), emp('g1')]
    const req = mergeReqs(
      reqFor(allDays, 'morning', GUARD, 1),
      reqFor(allDays, 'noon', GUARD, 1),
      reqFor(allDays, 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees, requirements: req, settings: on() }))
    expect(res.coverage.filledSlots).toBe(res.feasibility.maxStaffable)
    expect(res.coverage.filledSlots).toBe(res.coverage.requiredSlots)
    expect(res.feasibility.status).toBe('ok')
  })
})

describe('truly understaffed → minimal residual gaps', () => {
  it('no eligible employee left → gap remains as warning (engine fills max)', () => {
    // Zero employees, one night slot. Cannot be filled by anyone.
    const res = generateSchedule(
      input({ employees: [], requirements: reqFor([0], 'night', GUARD, 1), settings: on() }),
    )
    expect(res.warnings.length).toBe(1)
    expect(res.twelveHourAssignments).toEqual([])
    expect(res.coverage.filledSlots).toBe(0)
  })
})
