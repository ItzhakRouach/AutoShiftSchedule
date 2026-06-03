// End-to-end engine check: with priorWeekTail set, the engine refuses to put
// the carry-over employee on Sunday morning (would violate 8h rest vs prior
// Saturday night), but still happily places them on Sunday noon / later days.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, buildRequests, emp, input, mergeReqs, reqFor } from './fixtures'

describe('engine cross-week rest (priorWeekTail)', () => {
  it('blocks Sun-morning assignment for an employee with prior Sat-night tail', () => {
    // Two interchangeable guards; only one Sun-morning slot. Without prior tail
    // either could fill; with `a` carrying a prior-Sat-night (end abs 7), `b`
    // must win that slot — and `a` should be free to take Sun-noon instead.
    const a = emp('a', { minShifts: 1 })
    const b = emp('b', { minShifts: 1 })
    const reqs = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'noon', GUARD, 1))
    const i = input({
      employees: [a, b],
      requests: buildRequests([a, b]),
      requirements: reqs,
      priorWeekTail: { a: [7] }, // a worked prior Sat night → 0h gap vs Sun-morning
    })
    const r = generateSchedule(i)
    // Sun-morning must be 'b' (a is blocked by rest carryover).
    expect(r.grid[0].morning[GUARD]).toEqual(['b'])
    // a remains assignable elsewhere (e.g. Sun noon).
    const aAssign = r.assignmentsByEmployee['a'] ?? []
    expect(aAssign.some((x) => x.day === 0 && x.shift === 'morning')).toBe(false)
  })

  it('absent priorWeekTail is a no-op (existing behavior preserved)', () => {
    const a = emp('a', { minShifts: 1 })
    const b = emp('b', { minShifts: 1 })
    const reqs = reqFor([0], 'morning', GUARD, 1)
    const i = input({
      employees: [a, b], requests: buildRequests([a, b]), requirements: reqs,
    })
    const r = generateSchedule(i)
    // One of them fills morning — engine works without the new field set.
    expect(r.grid[0].morning[GUARD].length).toBe(1)
  })
})
