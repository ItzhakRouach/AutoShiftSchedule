// Block swap (pure helper for the night-balancing passes).
//
// Two workers exchange ALL of their plain 8h shifts on a run of consecutive
// days. A single night-for-day swap is often blocked by rest — the receiver
// would go from a night (ending 07:00) straight into their own next-morning
// shift. Swapping the following day as well hands the giver that morning and
// keeps each worker's rest pattern intact inside the block, so the night can
// still change hands. Only the block's edges need new rest checks.
//
// Every added shift is re-validated against all hard constraints, and both
// workers pass the request gate, exactly like the 2-swap and 3-cycle moves.
import type { Assignment, DayMeta, EngineInput } from './types'
import type { FillState } from './dayfill'
import { isAssignable } from './constraints'
import { preservesRequestsFor } from './request-gate'
import { nightCount } from './fairness'
import { wantsNight } from './night-targets'
import type { RequestGate } from './moves'

/** Day runs tried around a night on `day`, shortest first. */
const BLOCKS = (day: number) => [[day, day + 1], [day - 1, day], [day - 1, day, day + 1], [day, day + 1, day + 2]]

function swapped(st: FillState, from: string, to: string, days: Set<number>): Assignment[] {
  const keep = st.committed[to].filter((a) => !days.has(a.day))
  const take = st.committed[from].filter((a) => days.has(a.day)).map((a) => ({ ...a, employeeId: to }))
  return [...keep, ...take]
}

function blockLegal(
  input: EngineInput, metas: Record<number, DayMeta>, st: FillState,
  who: string, after: Assignment[], days: Set<number>, gate: RequestGate,
): boolean {
  const emp = input.employees.find((e) => e.id === who)!
  for (const a of after) {
    if (!days.has(a.day)) continue
    const ok = isAssignable({
      emp, meta: metas[a.day], shift: a.shift, roleId: a.roleId,
      request: input.requests[who]?.[a.day] ?? { off: false, preferred: [] },
      current: after.filter((x) => x !== a),
      settings: input.settings,
      priorTail: input.priorWeekTail?.[who], nextHead: input.nextWeekHead?.[who],
    })
    if (!ok) return false
  }
  return gate(input, who, st.committed[who], after)
}

/**
 * Try to move one of giver `g`'s nights (the one on `day`) to receiver `r` by
 * exchanging a block of days. Applied only if `g` ends with fewer nights and
 * `r` with more, and the pair's Σ nights² falls (so repeated calls terminate).
 */
export function tryBlockSwap(
  input: EngineInput, metas: Record<number, DayMeta>, st: FillState,
  g: string, r: string, day: number, gate: RequestGate = preservesRequestsFor,
): boolean {
  const ng = nightCount(st.committed[g])
  const nr = nightCount(st.committed[r])
  for (const run of BLOCKS(day)) {
    if (run.some((d) => !metas[d])) continue
    const days = new Set(run)
    const touched = [...st.committed[g], ...st.committed[r]].filter((a) => days.has(a.day))
    if (touched.some((a) => a.is12h)) continue // 12h coverage is never moved
    // Nights asked for (and only for) stay with whoever asked for them.
    if (touched.some((a) => a.shift === 'night' && wantsNight(input, a.employeeId, a.day))) continue
    const gAfter = swapped(st, r, g, days)
    const rAfter = swapped(st, g, r, days)
    const ng2 = nightCount(gAfter)
    const nr2 = nightCount(rAfter)
    if (!(ng2 < ng && nr2 > nr) || ng2 * ng2 + nr2 * nr2 >= ng * ng + nr * nr) continue
    if (!blockLegal(input, metas, st, g, gAfter, days, gate)) continue
    if (!blockLegal(input, metas, st, r, rAfter, days, gate)) continue
    for (const a of touched) {
      const cell = st.grid[a.day][a.shift][a.roleId]
      cell[cell.indexOf(a.employeeId)] = a.employeeId === g ? r : g
    }
    st.committed[g] = gAfter
    st.committed[r] = rAfter
    return true
  }
  return false
}
