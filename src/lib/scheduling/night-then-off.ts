// Coverage-preserving NIGHT→OFF pass. A worker who worked a night (23–07) on
// day D should NOT be left off on day D+1 — they should keep working — UNLESS
// there's genuinely no slot for them, or they REQUESTED off that next day. After
// a night, rest rules already bar the next morning, so we only try noon/night on
// D+1. The fix is a coverage-NEUTRAL displacement: the night worker takes a
// D+1 slot from a "sparable" co-worker (above their minimum, didn't request that
// shift, and didn't themselves work the prior night — so we never create a NEW
// night→off). If no sparable holder exists, the worker stays off (no option).
import type { DayMeta, DayRequest, EngineInput, Employee, ShiftKey } from './types'
import type { FillState } from './dayfill'
import { isAssignable } from './constraints'

// After a night, morning (07–15) is rest-blocked and a second night would stack
// consecutive nights (and risk the night cap), so the worker is kept on NOON.
const NEXT_SHIFTS: ShiftKey[] = ['noon']

function reqOf(input: EngineInput, id: string, day: number): DayRequest {
  return input.requests[id]?.[day] ?? { off: false, preferred: [] }
}

function workedNightOn(st: FillState, id: string, day: number): boolean {
  return st.committed[id]?.some((a) => a.day === day && a.shift === 'night' && !a.is12h) ?? false
}

function distinctDays(st: FillState, id: string): number {
  return new Set((st.committed[id] ?? []).map((a) => a.day)).size
}

export function runNightThenOffPass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): void {
  const empById = new Map(input.employees.map((e) => [e.id, e]))
  const ids = Object.keys(st.committed).sort()

  for (const d of input.days) {
    const D = d.index
    const dp1 = D + 1
    const metaNext = metas[dp1]
    if (!metaNext) continue

    for (const nId of ids) {
      if (!workedNightOn(st, nId, D)) continue
      if (st.committed[nId].some((a) => a.day === dp1)) continue // already works D+1
      if (reqOf(input, nId, dp1).off) continue // requested off next day → honor it
      const N = empById.get(nId)
      if (N) placeNextDay(input, st, metaNext, empById, N, dp1)
    }
  }
}

/** Try to seat night-worker `N` into a noon/night slot on `dp1` by displacing a
 *  sparable holder. Returns once seated (or leaves N off if none). */
function placeNextDay(
  input: EngineInput,
  st: FillState,
  metaNext: DayMeta,
  empById: Map<string, Employee>,
  N: Employee,
  dp1: number,
): void {
  for (const shift of NEXT_SHIFTS) {
    const byRole = st.grid[dp1]?.[shift]
    if (!byRole) continue
    for (const role of Object.keys(byRole)) {
      // N must legally hold this slot (role + rest from the night + Shabbat + max).
      const legal = isAssignable({
        emp: N, meta: metaNext, shift, roleId: role,
        request: reqOf(input, N.id, dp1), current: st.committed[N.id],
        settings: input.settings, priorTail: input.priorWeekTail?.[N.id],
      })
      if (!legal) continue

      const wId = [...byRole[role]].find((id) => {
        if (id === N.id) return false
        const cell = st.committed[id]?.find((a) => a.day === dp1 && a.shift === shift && a.roleId === role)
        if (!cell || cell.is12h) return false
        if (workedNightOn(st, id, dp1 - 1)) return false // don't create a new night→off
        if (reqOf(input, id, dp1).preferred.includes(shift)) return false // preserve their request
        const wMin = empById.get(id)?.minShifts ?? 0
        return distinctDays(st, id) > wMin // only displace an ABOVE-min holder
      })
      if (!wId) continue

      // Displace: remove W from the cell, seat N there (coverage unchanged).
      const wIdx = st.committed[wId].findIndex((a) => a.day === dp1 && a.shift === shift && a.roleId === role)
      if (wIdx < 0) continue
      st.committed[wId].splice(wIdx, 1)
      const occ = st.grid[dp1][shift][role]
      occ[occ.indexOf(wId)] = N.id
      st.committed[N.id].push({ employeeId: N.id, day: dp1, shift, roleId: role, is12h: false })
      return
    }
  }
}
