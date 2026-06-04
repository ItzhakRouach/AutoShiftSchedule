// Cross-week extras fairness: among two at-min full-timers fighting for an
// extra slot, the one who already worked above-min last published week (higher
// priorExtras) loses to the one who didn't.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, emp, input, reqFor } from './fixtures'

describe('cross-week extras fairness (priorExtras)', () => {
  it('full-timer who had extras last week loses an extra slot this week', () => {
    const a = emp('a', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 0 })
    const b = emp('b', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 2 })
    const res = generateSchedule(
      input({ employees: [a, b], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    // a had 0 extras last week → wins the contested extra; b had 2 → loses.
    expect(res.grid[0].morning[GUARD]).toEqual(['a'])
  })

  it('priorExtras does NOT override below-min reach-min (step 2 wins)', () => {
    // a is BELOW min (needs 1, has 0), b is AT min (min 0). priorExtras must
    // NOT block a from reaching min — step 2 is still authoritative.
    const a = emp('a', { employmentType: 'full', minShifts: 1, maxShifts: 5, priorExtras: 10 })
    const b = emp('b', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 0 })
    const res = generateSchedule(
      input({ employees: [a, b], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['a'])
  })

  it('priorExtras never overrides an off-request (hard constraint preserved)', () => {
    const a = emp('a', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 0 })
    const b = emp('b', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 5 })
    // a requests OFF on day 0 morning — b must still take it despite priorExtras.
    const requests: Record<string, Record<number, { off: boolean; preferred: string[] }>> = {
      a: { 0: { off: true, preferred: [] } },
      b: {},
    }
    const res = generateSchedule(
      input({
        employees: [a, b],
        requirements: reqFor([0], 'morning', GUARD, 1),
        requests: requests as never,
        seed: 1,
      }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['b'])
  })
})
