// Part A2: the manager (אחמ״ש) role must be split evenly across its holders,
// not merely satisfy each holder's own ≥ceil(N/2) in-role ratio.
import { describe, it, expect } from 'vitest'
import { runFill } from './fill'
import { emp, input, reqFor, mergeReqs, GUARD, SHIFT_MGR } from './fixtures'
import type { Assignment } from './types'

const mgrCount = (as: Assignment[]) => as.filter((a) => a.roleId === SHIFT_MGR).length

/** Three אחמ״ש holders, 6 days, 2 אחמ״ש + 1 מאבטח per morning.
 *  12 אחמ״ש slots over 3 holders ⇒ an even split is 4/4/4.
 *  Each holder works 6 shifts ⇒ their own in-role target is ceil(6/2) = 3,
 *  so a 6/3/3 split satisfies every individual ratio while being lopsided. */
function threeHolders() {
  const ids = ['a', 'b', 'c']
  return input({
    employees: ids.map((id) => emp(id, { roleIds: [SHIFT_MGR, GUARD] })),
    requirements: mergeReqs(
      reqFor([0, 1, 2, 3, 4, 5], 'morning', SHIFT_MGR, 2),
      reqFor([0, 1, 2, 3, 4, 5], 'morning', GUARD, 1),
    ),
    managerRoleId: SHIFT_MGR,
  })
}

describe('אחמ״ש even split across holders', () => {
  it('splits the manager role evenly (spread <= 1), not just >=ceil(N/2) each', () => {
    const inp = threeHolders()
    const st = runFill(inp)
    const counts = ['a', 'b', 'c'].map((id) => mgrCount(st.committed[id]))
    const total = ['a', 'b', 'c'].reduce((n, id) => n + st.committed[id].length, 0)
    expect(total).toBe(18) // coverage preserved: 6 days x 3 slots
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('never drops a holder below their own ceil(N/2) in-role target', () => {
    const inp = threeHolders()
    const st = runFill(inp)
    for (const id of ['a', 'b', 'c']) {
      const as = st.committed[id]
      expect(mgrCount(as)).toBeGreaterThanOrEqual(Math.ceil(as.length / 2))
    }
  })
})
