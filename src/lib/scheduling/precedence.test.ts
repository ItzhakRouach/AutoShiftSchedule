// FIX A: canonical precedence — "full-time first ONLY up to their minimum,
// then requests / the >=2 floor win". Proves compareCandidates + the engine fill.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, buildRequests, emp, input, mergeReqs, reqFor } from './fixtures'

describe('FIX A — full-time-first-until-min precedence', () => {
  // (a) HYBRID policy: a part-time REQUESTER beats a below-min full-time
  // NON-requester for the contended slot — an explicit request outranks giving
  // another worker their minimum. (The full-timer pursues their minimum on the
  // remaining slots; here there is only one, so the request wins it.)
  it('a requester beats a below-min non-requester for a scarce slot', () => {
    const ft = emp('ft', { employmentType: 'full', minShifts: 2 })
    const pt = emp('pt', { employmentType: 'part', minShifts: 0 })
    const requests = buildRequests([ft, pt], (id, d) =>
      id === 'pt' && d === 0 ? { preferred: ['morning'] } : {},
    )
    const res = generateSchedule(
      input({ employees: [ft, pt], requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['pt'])
  })

  // (b) full-time already AT/above min, did NOT request, vs part-time who DID
  // request → part-time (requester) wins (tier no longer grants priority).
  it('at-min full-timer loses to a part-time requester', () => {
    const ft = emp('ft', { employmentType: 'full', minShifts: 0 })
    const pt = emp('pt', { employmentType: 'part', minShifts: 0 })
    const requests = buildRequests([ft, pt], (id, d) =>
      id === 'pt' && d === 0 ? { preferred: ['morning'] } : {},
    )
    const res = generateSchedule(
      input({ employees: [ft, pt], requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['pt'])
  })

  // (c) the existing >=2 floor fixture (a=2/b=2) still holds: 2 slots, 2 reqs → 1 each.
  it('>=2 floor fixture still holds (each requester gets exactly 1)', () => {
    const a = emp('a')
    const b = emp('b')
    const requests = buildRequests([a, b], () => ({ preferred: ['morning'] }))
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([1], 'morning', GUARD, 1))
    const res = generateSchedule(input({ employees: [a, b], requirements: req, requests, seed: 1 }))
    expect(res.stats.a.requestsSatisfied).toBe(1)
    expect(res.stats.b.requestsSatisfied).toBe(1)
  })

  // (d) two full-timers BOTH below min, one requested → requester wins.
  it('among below-min full-timers, the requester wins', () => {
    const r = emp('r', { employmentType: 'full', minShifts: 2 })
    const n = emp('n', { employmentType: 'full', minShifts: 2 })
    const requests = buildRequests([r, n], (id, d) =>
      id === 'r' && d === 0 ? { preferred: ['morning'] } : {},
    )
    const res = generateSchedule(
      input({ employees: [r, n], requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['r'])
  })
})
