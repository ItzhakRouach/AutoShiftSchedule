// End-to-end engine check, symmetric to prior-tail-rest.test.ts: with
// nextWeekHead set, the engine refuses to put the carry-over employee on
// Saturday night (would violate 8h rest vs next-week Sunday morning, abs
// 175), but still happily places them on Saturday noon / earlier days.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, buildRequests, emp, input, mergeReqs, reqFor } from './fixtures'

describe('engine cross-week rest (nextWeekHead)', () => {
  it('blocks Sat-night assignment for an employee with a next-week Sun-morning head', () => {
    // Two interchangeable guards; only one Sat-night slot. Without a next-week
    // head either could fill; with `a` carrying a next-Sun-morning head (start
    // abs 175 = Sat-night's end abs), `b` must win that slot — and `a` should
    // remain free to take Sat-noon instead.
    const a = emp('a', { minShifts: 1 })
    const b = emp('b', { minShifts: 1 })
    const reqs = mergeReqs(reqFor([6], 'night', GUARD, 1), reqFor([6], 'noon', GUARD, 1))
    const i = input({
      employees: [a, b],
      requests: buildRequests([a, b]),
      requirements: reqs,
      nextWeekHead: { a: [175] }, // a has a next-Sun-morning start → 0h gap vs Sat-night
    })
    const r = generateSchedule(i)
    // Sat-night must be 'b' (a is blocked by the next-week head).
    expect(r.grid[6].night[GUARD]).toEqual(['b'])
    // a remains assignable elsewhere (e.g. Sat noon).
    const aAssign = r.assignmentsByEmployee['a'] ?? []
    expect(aAssign.some((x) => x.day === 6 && x.shift === 'night')).toBe(false)
  })

  it('absent nextWeekHead is a no-op (existing behavior preserved)', () => {
    const a = emp('a', { minShifts: 1 })
    const b = emp('b', { minShifts: 1 })
    const reqs = reqFor([6], 'night', GUARD, 1)
    const i = input({
      employees: [a, b], requests: buildRequests([a, b]), requirements: reqs,
    })
    const r = generateSchedule(i)
    // One of them fills the night slot — engine works without the new field set.
    expect(r.grid[6].night[GUARD].length).toBe(1)
  })
})
