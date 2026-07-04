// Change 1: the request floor guarantees "at least half" of an employee's
// requests, without ever dropping below the legacy ≥2 floor.
//   floorTarget(rc) = max(min(2, rc), ceil(rc / 2))
// rc ≤ 4 → unchanged (old min(2, rc)); rc ≥ 5 → raised to ceil(rc / 2).
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, buildRequests, emp, input, reqFor } from './fixtures'
import { floorTarget, compareFloorProgress } from './request-gate'
import type { ShiftKey } from './types'

const SH: ShiftKey[] = ['morning', 'noon', 'night']

/** Build an input where employee `id` makes `n` distinct (day,shift) requests
 *  (packed 3-per-day across days). */
function reqInput(id: string, n: number) {
  const e = emp(id)
  const requests = buildRequests([e], (eid, d) => {
    if (eid !== id) return {}
    const start = d * 3
    return { preferred: SH.filter((_, i) => start + i < n) }
  })
  return { inp: input({ employees: [e], requests }), id }
}

describe('floorTarget = max(min(2, rc), ceil(rc / 2))', () => {
  it('never below the legacy ≥2 floor, raises to half for heavy requesters', () => {
    const expected: Record<number, number> = {
      0: 0, 1: 1, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5,
    }
    for (const [n, exp] of Object.entries(expected)) {
      const { inp, id } = reqInput('x', Number(n))
      expect(floorTarget(inp, id)).toBe(exp)
    }
  })
})

describe('compareFloorProgress: below-own-floor first, then fewer satisfied', () => {
  it('an employee below its floor outranks one that met its (possibly lower) floor', () => {
    // a: 2/3 (below), b: 2/2 (met) → a must sort first even at equal satisfied.
    expect(compareFloorProgress(2, 3, 2, 2)).toBeLessThan(0)
    expect(compareFloorProgress(2, 2, 2, 3)).toBeGreaterThan(0)
  })
  it('among below-floor employees, fewer satisfied sorts first', () => {
    expect(compareFloorProgress(0, 3, 1, 3)).toBeLessThan(0)
    expect(compareFloorProgress(2, 3, 0, 3)).toBeGreaterThan(0)
  })
  it('employees that both met their floor tie (extras deferred to fairness)', () => {
    expect(compareFloorProgress(3, 3, 4, 2)).toBe(0)
    expect(compareFloorProgress(5, 3, 2, 2)).toBe(0)
  })
  it('reproduces the legacy fixed-floor ordering when both floors are 2', () => {
    expect(compareFloorProgress(0, 2, 1, 2)).toBeLessThan(0) // 0 before 1
    expect(compareFloorProgress(1, 2, 2, 2)).toBeLessThan(0) // below before met
    expect(compareFloorProgress(2, 2, 3, 2)).toBe(0) // both met → tie
  })
})

describe('engine delivers at least half of a heavy requester’s requests', () => {
  it('two employees each requesting 6 mornings both reach ≥3 satisfied', () => {
    const a = emp('a')
    const b = emp('b')
    const days = [0, 1, 2, 3, 4, 5]
    const requests = buildRequests([a, b], () => ({ preferred: ['morning'] }))
    const res = generateSchedule(
      input({
        employees: [a, b],
        requirements: reqFor(days, 'morning', GUARD, 1),
        requests,
        seed: 1,
      }),
    )
    // 6 morning slots, 2 requesters, floor = ceil(6/2) = 3 each → both met.
    expect(res.stats['a'].requestsSatisfied).toBeGreaterThanOrEqual(3)
    expect(res.stats['b'].requestsSatisfied).toBeGreaterThanOrEqual(3)
  })
})
