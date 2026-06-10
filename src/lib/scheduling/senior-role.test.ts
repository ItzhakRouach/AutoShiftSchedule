import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, DISPATCH, emp, input, mergeReqs, reqFor } from './fixtures'

describe('senior-role pass', () => {
  it('swaps a senior into their role when a regular holds it in the same shift', () => {
    // One shift (day 0 morning) needs 1 GUARD + 1 MOKED. `sr` is senior for GUARD
    // and holds both roles; `reg` holds both but is regular. Whoever the matcher
    // routes to GUARD, the senior-role pass must end with sr in GUARD.
    const sr = emp('sr', { roleIds: [GUARD, DISPATCH], seniorRoleIds: [GUARD] })
    const reg = emp('reg', { roleIds: [GUARD, DISPATCH] })
    const reqs = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'morning', DISPATCH, 1))
    const res = generateSchedule(input({ employees: [sr, reg], requirements: reqs, seed: 7 }))
    expect(res.grid[0].morning[GUARD]).toEqual(['sr'])
    expect(res.grid[0].morning[DISPATCH]).toEqual(['reg'])
  })

  it('leaves things as-is when the regular cannot take the senior’s other role', () => {
    // reg holds ONLY GUARD, so the swap (reg→MOKED) is illegal; sr stays in MOKED.
    const sr = emp('sr', { roleIds: [GUARD, DISPATCH], seniorRoleIds: [GUARD] })
    const reg = emp('reg', { roleIds: [GUARD] })
    const reqs = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'morning', DISPATCH, 1))
    const res = generateSchedule(input({ employees: [sr, reg], requirements: reqs, seed: 7 }))
    // reg can only be GUARD; sr must take MOKED — coverage preserved, no illegal swap.
    expect(res.grid[0].morning[GUARD]).toEqual(['reg'])
    expect(res.grid[0].morning[DISPATCH]).toEqual(['sr'])
  })
})
