import { describe, it, expect } from 'vitest'
import { runFill } from './fill'
import { nightCount } from './fairness'
import { emp, input, reqFor, mergeReqs, GUARD } from './fixtures'

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
})
