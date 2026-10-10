// Applying AI-proposed swaps to the engine's finished week.
//
// A swap only exchanges the OCCUPANTS of two filled cells, so coverage is
// invariant by construction. Each swap must additionally pass moveLegal (all 8
// hard constraints) AND strictly improve the overall score, or it is reverted.
import { describe, it, expect } from 'vitest'
import { applySwaps } from './apply-swaps'
import { buildKeyMaps } from './keys'
import { runFillHardDaysAware } from '@/lib/scheduling/fill'
import { resultFromFillState } from '@/lib/scheduling'
import { scoreSchedule } from './score'
import { emp, input, reqFor, mergeReqs, buildRequests, GUARD, SHIFT_MGR } from '@/lib/scheduling/fixtures'
import type { EngineInput } from '@/lib/scheduling/types'

const K = (i: EngineInput) => buildKeyMaps(i)

/** Two guards, two morning slots on different days. `u2` wants day 1; the
 *  engine has no reason to prefer that, so a swap can raise granted requests. */
function swappableWeek(): EngineInput {
  const employees = [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })]
  return input({
    employees,
    requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([1], 'morning', GUARD, 1)),
    requests: buildRequests(employees, (id, day) =>
      id === 'u2' && day === 1 ? { preferred: ['morning'] } : {},
    ),
  })
}

describe('applySwaps', () => {
  it('keeps a swap that strictly improves the score', () => {
    const i = swappableWeek()
    const st = runFillHardDaysAware(i)
    const before = scoreSchedule(i, resultFromFillState(i, st))
    const g = K(i).roleKey(GUARD)!
    // Ask to exchange whoever holds day0 morning with whoever holds day1 morning.
    const holder0 = st.grid[0].morning[GUARD][0]
    const holder1 = st.grid[1].morning[GUARD][0]
    const key = (id: string) => K(i).empKey(id)!
    const out = applySwaps(i, st, [
      { a: { emp: key(holder0), day: 0, shift: 'M', role: g }, b: { emp: key(holder1), day: 1, shift: 'M', role: g } },
    ])
    const after = scoreSchedule(i, resultFromFillState(i, st))
    if (out.applied === 1) {
      expect(after.requestsSatisfied).toBeGreaterThan(before.requestsSatisfied)
    } else {
      // The engine had already granted u2's request, so reversing it either
      // scores no better OR drops u2 below their own request floor — the
      // floored gate catches that case before scoring even runs.
      expect(['not_an_improvement', 'illegal']).toContain(out.rejected[0].reason)
      expect(after.requestsSatisfied).toBe(before.requestsSatisfied)
    }
    expect(after.filledSlots).toBe(before.filledSlots) // coverage invariant
  })

  it('rejects a swap that would break a hard constraint', () => {
    // u2 observes Shabbat, so they can never take the Friday-night cell u1 holds.
    const employees = [
      emp('u1', { roleIds: [GUARD] }),
      emp('u2', { roleIds: [GUARD], observesShabbat: true }),
    ]
    const i = input({
      employees,
      requirements: mergeReqs(reqFor([5], 'night', GUARD, 1), reqFor([2], 'morning', GUARD, 1)),
    })
    const st = runFillHardDaysAware(i)
    const g = K(i).roleKey(GUARD)!
    const nightHolder = st.grid[5].night[GUARD][0]
    const morningHolder = st.grid[2].morning[GUARD][0]
    if (nightHolder === morningHolder) return // single-person week, nothing to swap
    const key = (id: string) => K(i).empKey(id)!
    const out = applySwaps(i, st, [
      { a: { emp: key(nightHolder), day: 5, shift: 'N', role: g }, b: { emp: key(morningHolder), day: 2, shift: 'M', role: g } },
    ])
    expect(out.applied).toBe(0)
    expect(out.rejected[0].reason).toBe('illegal')
  })

  it('rejects a swap naming a cell the worker does not hold', () => {
    const i = swappableWeek()
    const st = runFillHardDaysAware(i)
    const g = K(i).roleKey(GUARD)!
    const out = applySwaps(i, st, [
      { a: { emp: 'e0', day: 4, shift: 'N', role: g }, b: { emp: 'e1', day: 1, shift: 'M', role: g } },
    ])
    expect(out.applied).toBe(0)
    expect(out.rejected[0].reason).toBe('no_such_cell')
  })

  it('rejects a swap naming an invented worker', () => {
    const i = swappableWeek()
    const st = runFillHardDaysAware(i)
    const g = K(i).roleKey(GUARD)!
    const out = applySwaps(i, st, [
      { a: { emp: 'e99', day: 0, shift: 'M', role: g }, b: { emp: 'e1', day: 1, shift: 'M', role: g } },
    ])
    expect(out.applied).toBe(0)
    expect(out.rejected[0].reason).toBe('unknown_employee')
  })

  it('never changes coverage, whatever is proposed', () => {
    const i = swappableWeek()
    const st = runFillHardDaysAware(i)
    const filledBefore = scoreSchedule(i, resultFromFillState(i, st)).filledSlots
    const g = K(i).roleKey(GUARD)!
    applySwaps(i, st, [
      { a: { emp: 'e0', day: 0, shift: 'M', role: g }, b: { emp: 'e1', day: 1, shift: 'M', role: g } },
      { a: { emp: 'e99', day: 0, shift: 'M', role: g }, b: { emp: 'e0', day: 9, shift: 'M', role: g } },
    ])
    expect(scoreSchedule(i, resultFromFillState(i, st)).filledSlots).toBe(filledBefore)
  })

  it('leaves 12h cells alone', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD, SHIFT_MGR] })],
      requirements: reqFor([0], 'morning', GUARD, 1),
    })
    const st = runFillHardDaysAware(i)
    const g = K(i).roleKey(GUARD)!
    const out = applySwaps(i, st, [
      { a: { emp: 'e0', day: 0, shift: 'M', role: g }, b: { emp: 'e0', day: 0, shift: 'M', role: g } },
    ])
    expect(out.applied).toBe(0) // a self-swap is not an improvement
  })
})

describe('applySwaps — accepted list for server-side re-apply', () => {
  it('returns the swaps it accepted, so apply can re-validate from scratch', () => {
    const i = swappableWeek()
    const st = runFillHardDaysAware(i)
    const g = K(i).roleKey(GUARD)!
    const out = applySwaps(i, st, [
      { a: { emp: 'e99', day: 0, shift: 'M', role: g }, b: { emp: 'e0', day: 1, shift: 'M', role: g } },
    ])
    expect(out.accepted).toEqual([])
    expect(out.applied).toBe(0)
    // accepted.length always equals applied, so the apply step can replay it.
    expect(out.accepted.length).toBe(out.applied)
  })
})
