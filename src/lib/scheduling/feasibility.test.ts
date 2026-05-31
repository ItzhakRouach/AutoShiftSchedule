import { describe, it, expect } from 'vitest'
import { checkFeasibility, countRequiredSlots, maxStaffableSlots } from './feasibility'
import { generateSchedule } from './engine'
import { buildTwelveHourSuggestions } from './fallback'
import {
  GUARD,
  emp,
  input,
  mergeReqs,
  reqFor,
  settings,
} from './fixtures'

const allDays = [0, 1, 2, 3, 4, 5, 6]

describe('feasibility pre-check', () => {
  it('OK: enough employees for all 8h slots', () => {
    const employees = Array.from({ length: 7 }, (_, i) => emp(`g${i}`))
    const f = checkFeasibility(
      input({ employees, requirements: reqFor(allDays, 'morning', GUARD, 1) }),
    )
    expect(f.status).toBe('ok')
    expect(f.requiredSlots).toBe(7)
    expect(f.shortBy).toBe(0)
  })

  it('counts required slots across shifts/roles', () => {
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 2),
      reqFor([0], 'night', GUARD, 1),
    )
    expect(countRequiredSlots(input({ employees: [], requirements: req }))).toBe(3)
  })

  it('SHORT: not enough employees, no 12h fallback', () => {
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const f = checkFeasibility(
      input({ employees: [emp('a')], requirements: req, settings: settings({ allow12hFallback: false }) }),
    )
    expect(f.status).toBe('short')
    expect(f.requiredSlots).toBe(3)
    expect(f.maxStaffable).toBe(1) // one shift per day
    expect(f.shortBy).toBe(2)
  })

  it('NEEDS12H: same shortage but 12h fallback enabled', () => {
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const f = checkFeasibility(
      input({ employees: [emp('a')], requirements: req, settings: settings({ allow12hFallback: true }) }),
    )
    expect(f.status).toBe('needs12h')
    expect(f.shortBy).toBe(2)
  })
})

describe('12h fallback suggestions', () => {
  const req = mergeReqs(
    reqFor([0], 'morning', GUARD, 1),
    reqFor([0], 'noon', GUARD, 1),
    reqFor([0], 'night', GUARD, 1),
  )

  it('populated only when allow12hFallback (understaffed)', () => {
    const off = generateSchedule(
      input({ employees: [emp('a')], requirements: req, settings: settings({ allow12hFallback: false }) }),
    )
    expect(off.twelveHourSuggestions).toEqual([])

    const on = generateSchedule(
      input({ employees: [emp('a')], requirements: req, settings: settings({ allow12hFallback: true }) }),
    )
    expect(on.twelveHourSuggestions.length).toBeGreaterThan(0)
    for (const s of on.twelveHourSuggestions) expect(s.day).toBe(0)
  })

  it('whole-week 12h scenario: one employee, full grid → many suggestions', () => {
    const fullGrid = mergeReqs(
      reqFor(allDays, 'morning', GUARD, 1),
      reqFor(allDays, 'noon', GUARD, 1),
      reqFor(allDays, 'night', GUARD, 1),
    )
    const res = generateSchedule(
      input({ employees: [emp('a', { maxShifts: 7 })], requirements: fullGrid, settings: settings({ allow12hFallback: true }) }),
    )
    // 21 slots, 1 employee can take ~7 → ~14 uncovered → suggestions for the gaps
    expect(res.twelveHourSuggestions.length).toBeGreaterThan(7)
  })

  it('isolated single understaffed shift → exactly one suggestion', () => {
    const res = generateSchedule(
      input({ employees: [], requirements: reqFor([3], 'night', GUARD, 1), settings: settings({ allow12hFallback: true }) }),
    )
    expect(res.twelveHourSuggestions).toHaveLength(1)
    expect(res.twelveHourSuggestions[0].variant).toBe('m12_night')
  })

  it('buildTwelveHourSuggestions dedups per (day,variant,role)', () => {
    const warnings = [
      { day: 0, shift: 'morning' as const, roleId: GUARD, missing: 1 },
      { day: 0, shift: 'morning' as const, roleId: GUARD, missing: 1 },
    ]
    expect(buildTwelveHourSuggestions(warnings, settings({ allow12hFallback: true }))).toHaveLength(1)
  })
})

describe('coverage/stats exact values', () => {
  it('half-staffed grid: exact coverage math', () => {
    // 2 days morning (2 slots), 1 employee max 1 → fills day0 only.
    const req = reqFor([0, 1], 'morning', GUARD, 1)
    const res = generateSchedule(
      input({ employees: [emp('a', { maxShifts: 1, minShifts: 1 })], requirements: req }),
    )
    expect(res.coverage.requiredSlots).toBe(2)
    expect(res.coverage.filledSlots).toBe(1)
    expect(res.coverage.percent).toBe(50)
    expect(res.stats.a.shifts).toBe(1)
    expect(res.stats.a.hours).toBe(8)
    expect(res.stats.a.belowMin).toBe(false)
    expect(res.warnings).toHaveLength(1)
  })
  it('maxStaffableSlots respects rest (night then morning same employee blocked)', () => {
    const req = mergeReqs(reqFor([0], 'night', GUARD, 1), reqFor([1], 'morning', GUARD, 1))
    // single employee: night day0 then morning day1 violates rest → can only staff 1
    expect(
      maxStaffableSlots(input({ employees: [emp('a', { maxShifts: 7 })], requirements: req })),
    ).toBe(1)
  })
})
