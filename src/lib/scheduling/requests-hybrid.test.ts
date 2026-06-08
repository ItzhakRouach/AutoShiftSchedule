import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, buildRequests, emp, input, reqFor, mergeReqs } from './fixtures'

// HYBRID request policy (רותם's case): a worker's requested shifts are ALL
// honored even when another worker needs shifts to reach their minimum —
// requests outrank another worker's minimum. Minimums are still pursued on the
// remaining slots.
describe('hybrid request honoring', () => {
  it("honors all of a worker's requests over another worker's minimum", () => {
    // R requests morning on days 0,1,2. B (full, min 3) requested nothing.
    const r = emp('r', { minShifts: 0, maxShifts: 6 })
    const b = emp('b', { employmentType: 'full', minShifts: 3, maxShifts: 6 })
    const requests = buildRequests([r, b], (id, d) =>
      id === 'r' && d <= 2 ? { preferred: ['morning'] } : {},
    )
    // 7 morning slots (days 0–6): plenty for R's 3 requests AND B's minimum.
    const res = generateSchedule(
      input({
        employees: [r, b],
        requirements: reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 1),
        requests,
        seed: 1,
      }),
    )
    // All three of R's requested mornings are honored.
    for (const d of [0, 1, 2]) {
      expect(res.grid[d].morning[GUARD]).toContain('r')
    }
  })

  it('a requester wins the only contended slot they asked for', () => {
    // Only ONE slot exists and R requested it; below-min B wanted to reach min
    // but the request wins it.
    const r = emp('r', { minShifts: 0 })
    const b = emp('b', { employmentType: 'full', minShifts: 1 })
    const requests = buildRequests([r, b], (id, d) =>
      id === 'r' && d === 0 ? { preferred: ['night'] } : {},
    )
    const res = generateSchedule(
      input({
        employees: [r, b],
        requirements: mergeReqs(reqFor([0], 'night', GUARD, 1)),
        requests,
        seed: 1,
      }),
    )
    expect(res.grid[0].night[GUARD]).toEqual(['r'])
  })
})
