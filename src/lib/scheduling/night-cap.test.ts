import { describe, it, expect } from 'vitest'
import { runFill } from './fill'
import { nightCount } from './fairness'
import { buildNightThresholds } from './diversity'
import { emp, input, reqFor, mergeReqs, GUARD, SHIFT_MGR, DISPATCH } from './fixtures'
import type { Employee, ShiftKey } from './types'

// Replicates the דניאל situation: an unrestricted guard who requested nothing
// must NOT be loaded with > 3 nights when other guards could take those nights.
function nightHeavyWeek(nGuards: number, seed: number) {
  const employees = Array.from({ length: nGuards }, (_, i) =>
    emp(String.fromCharCode(97 + i), { minShifts: 5, maxShifts: 6, roleIds: [GUARD] }),
  )
  // 2 nights + 1 morning + 1 noon every day → nights are spreadable across guards.
  const requirements = mergeReqs(
    reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 2),
    reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 1),
    reqFor([0, 1, 2, 3, 4, 5, 6], 'noon', GUARD, 1),
  )
  return input({ employees, requirements, seed })
}

describe('night cap (≤3) on a regenerated schedule', () => {
  it('no unrestricted guard exceeds 3 nights when nights are spreadable', () => {
    for (const [n, seed] of [[6, 1], [7, 4], [8, 9]] as const) {
      const inp = nightHeavyWeek(n, seed)
      const st = runFill(inp)
      const maxNights = Math.max(
        ...inp.employees.map((e) => nightCount(st.committed[e.id] ?? [])),
      )
      // 14 night slots over n≥6 guards ⇒ ≤3 each is achievable.
      expect(maxNights).toBeLessThanOrEqual(3)
    }
  })

  // Regression for דניאל: a Shabbat-observer booked every available day would,
  // without SAME-day swaps, pile up nights (no free day for a cross-day swap).
  // The night-unload pass must still cap them ≤3 by trading same-day shifts.
  it('caps nights for a near-fully-booked Shabbat worker via same-day swaps', () => {
    const booked = emp('booked', { observesShabbat: true, minShifts: 6, maxShifts: 6, roleIds: [GUARD] })
    const others = Array.from({ length: 6 }, (_, i) =>
      emp(`o${i}`, { minShifts: 0, maxShifts: 6, roleIds: [GUARD] }),
    )
    const requirements = mergeReqs(
      reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 1),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 1),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'noon', GUARD, 1),
    )
    const st = runFill(input({ employees: [booked, ...others], requirements, seed: 2 }))
    expect(nightCount(st.committed['booked'] ?? [])).toBeLessThanOrEqual(3)
  })

  // Regression: the diversity pass optimises rest quality in the SAME cost tier
  // as the night soft-cap, so before the hard gate it would trade the cap away —
  // pushing an אחמ״ש from 3 to 4 nights to shave a tight turnaround. With a
  // multi-role week + a night-only worker (עאדל), assert NO capped worker ends
  // over 3 nights (night-only workers are exempt).
  it('diversity never trades the night cap for rest quality (multi-role week)', () => {
    const days = [0, 1, 2, 3, 4, 5, 6]
    const mgrs = ['dan', 'tzachi', 'rotem', 'nir'].map((id) => emp(id, { roleIds: [SHIFT_MGR, DISPATCH, GUARD] }))
    const dsp = ['ofek', 'liran', 'yarin'].map((id) => emp(id, { roleIds: [DISPATCH, GUARD] }))
    const grd = ['g1', 'g2', 'g3', 'shalo'].map((id) => emp(id, { roleIds: [GUARD] }))
    const adel = emp('adel', { roleIds: [GUARD], availability: Object.fromEntries(days.map((d) => [d, ['night'] as ShiftKey[]])) })
    const employees: Employee[] = [...mgrs, ...dsp, ...grd, adel]
    const requirements = mergeReqs(
      reqFor(days, 'morning', SHIFT_MGR, 1), reqFor(days, 'morning', DISPATCH, 1), reqFor(days, 'morning', GUARD, 1),
      reqFor(days, 'noon', SHIFT_MGR, 1), reqFor(days, 'noon', DISPATCH, 1), reqFor(days, 'noon', GUARD, 1),
      reqFor(days, 'night', SHIFT_MGR, 1), reqFor(days, 'night', DISPATCH, 1), reqFor(days, 'night', GUARD, 1),
    )
    const inp = input({ employees, requirements, managerRoleId: SHIFT_MGR, seed: 5 })
    const st = runFill(inp)
    const thr = buildNightThresholds(inp)
    for (const e of employees) {
      if (!Number.isFinite(thr[e.id])) continue // night-only (עאדל) exempt
      expect(nightCount(st.committed[e.id] ?? [])).toBeLessThanOrEqual(3)
    }
  })
})
