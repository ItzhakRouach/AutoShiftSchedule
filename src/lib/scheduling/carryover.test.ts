// Cross-week minimum fairness: an employee SHORT of their minimum last published
// week (higher priorDeficit) is prioritized to reach their minimum this week —
// but only via LEGAL assignments. Off-requests stay hard, coverage is unchanged
// (it's an ordering/reservation tiebreak), and the result stays deterministic.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { runFill, countFilled } from './fill'
import { GUARD, buildRequests, emp, input, reqFor } from './fixtures'

describe('cross-week minimum fairness (priorDeficit)', () => {
  // Two below-min full-timers, neither requested, ONE contended slot. The one
  // carrying the larger prior-week deficit wins it (deficit sub-orders below-min
  // candidates ahead of employment tier / fairness / lottery).
  it('higher-deficit below-min employee wins a scarce slot', () => {
    const a = emp('a', { employmentType: 'full', minShifts: 1, priorDeficit: 0 })
    const b = emp('b', { employmentType: 'full', minShifts: 1, priorDeficit: 3 })
    const res = generateSchedule(
      input({ employees: [a, b], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['b'])
  })

  // Deficit employee reaches their FULL minimum this week when slots are feasible:
  // two morning slots over two days, deficit employee has minShifts=2.
  it('deficit employee reaches their minimum when feasible', () => {
    const a = emp('a', { employmentType: 'full', minShifts: 0, priorDeficit: 0 })
    const b = emp('b', { employmentType: 'full', minShifts: 2, priorDeficit: 2, maxShifts: 2 })
    const req = { ...reqFor([0], 'morning', GUARD, 1), ...reqFor([1], 'morning', GUARD, 1) }
    const res = generateSchedule(input({ employees: [a, b], requirements: req, seed: 1 }))
    expect(res.stats.b.shifts).toBe(2)
    expect(res.stats.b.belowMin).toBe(false)
  })

  // Off-request stays HARD: a high-deficit employee who requested OFF on the only
  // day they could work is NOT forced onto that day.
  it('off-request is never overridden by carry-over deficit', () => {
    const a = emp('a', { employmentType: 'full', minShifts: 1, priorDeficit: 0 })
    const b = emp('b', { employmentType: 'full', minShifts: 1, priorDeficit: 5 })
    const requests = buildRequests([a, b], (id, d) => (id === 'b' && d === 0 ? { off: true } : {}))
    const res = generateSchedule(
      input({ employees: [a, b], requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['a'])
    expect(res.assignmentsByEmployee.b ?? []).toEqual([])
  })

  // Coverage is identical with vs without the carry-over weighting (ordering only).
  it('coverage unchanged by carry-over weighting', () => {
    const employees = [
      emp('a', { minShifts: 1, priorDeficit: 0 }),
      emp('b', { minShifts: 1, priorDeficit: 4 }),
      emp('c', { minShifts: 1, priorDeficit: 2 }),
    ]
    const req = { ...reqFor([0], 'morning', GUARD, 2), ...reqFor([1], 'morning', GUARD, 1) }
    const withDeficit = input({ employees, requirements: req, seed: 3 })
    const noDeficit = input({
      employees: employees.map((e) => ({ ...e, priorDeficit: 0 })),
      requirements: req,
      seed: 3,
    })
    expect(countFilled(runFill(withDeficit))).toBe(countFilled(runFill(noDeficit)))
  })

  // Determinism: identical inputs → identical grid, twice.
  it('deterministic with carry-over deficits', () => {
    const make = () => {
      const employees = [
        emp('a', { minShifts: 1, priorDeficit: 1 }),
        emp('b', { minShifts: 1, priorDeficit: 3 }),
      ]
      return generateSchedule(
        input({ employees, requirements: reqFor([0], 'morning', GUARD, 1), seed: 9 }),
      ).grid
    }
    expect(make()).toEqual(make())
  })
})
