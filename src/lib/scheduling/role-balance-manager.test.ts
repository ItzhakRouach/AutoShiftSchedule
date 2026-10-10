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

/** 3 holders, 6 days, ONE אחמ״ש + 2 מאבטח per morning.
 *  Only 6 אחמ״ש slots exist but each holder works 6 shifts, so every per-holder
 *  target is ceil(6/2)=3 and the targets sum to 9 > 6 — collectively
 *  unreachable. An even 2/2/2 split is legal and obviously better. */
function underSuppliedManagerWeek() {
  const ids = ['a', 'b', 'c']
  return input({
    employees: ids.map((id) => emp(id, { roleIds: [SHIFT_MGR, GUARD] })),
    requirements: mergeReqs(
      reqFor([0, 1, 2, 3, 4, 5], 'morning', SHIFT_MGR, 1),
      reqFor([0, 1, 2, 3, 4, 5], 'morning', GUARD, 2),
    ),
    managerRoleId: SHIFT_MGR,
  })
}

describe('אחמ״ש split when the per-holder target is unreachable', () => {
  // Regression: the giver guard compared only against ceil(N/2). When the
  // manager slots are under-supplied relative to holders, that target is
  // unreachable for EVERYONE, so the guard froze a 0/3/3 split instead of
  // allowing the legal 2/2/2. Found by testing the AI improvement pass on the
  // live site — the AI proposed exactly the swaps this guard was forbidding.
  it('still evens the split when nobody can reach ceil(N/2)', () => {
    const inp = underSuppliedManagerWeek()
    const st = runFill(inp)
    const counts = ['a', 'b', 'c'].map((id) => mgrCount(st.committed[id]))
    expect(counts.reduce((x, y) => x + y, 0)).toBe(6) // all אחמ״ש slots filled
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('never drops a giver below their equal share of the manager work available', () => {
    const inp = underSuppliedManagerWeek()
    const st = runFill(inp)
    // 6 slots / 3 holders ⇒ an equal share is 2; nobody may end below that.
    for (const id of ['a', 'b', 'c']) expect(mgrCount(st.committed[id])).toBeGreaterThanOrEqual(2)
  })

  it('keeps honouring ceil(N/2) when the target IS reachable', () => {
    const inp = threeHolders() // 12 אחמ״ש slots, 3 holders, 6 shifts each
    const st = runFill(inp)
    for (const id of ['a', 'b', 'c']) {
      const rows = st.committed[id]
      expect(mgrCount(rows)).toBeGreaterThanOrEqual(Math.ceil(rows.length / 2))
    }
  })
})
