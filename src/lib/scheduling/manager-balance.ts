// Coverage-preserving MANAGER-BALANCE pass. Every holder of the manager (top-
// rank) role — e.g. אחמ״ש — should work at least HALF of their shifts IN that
// role rather than filling lower roles. The matcher + diversity pass balance
// role COUNTS across holders but don't guarantee each holder's own ratio, so a
// manager can end up mostly in guard/dispatch cells. This pass fixes that with
// same-shift role SWAPS: for a manager-holder A still below their target who
// holds a non-manager role X in a shift, if a NON-senior manager-holder B holds
// the manager slot of the SAME shift, can legally take X, and stays at/above B's
// OWN target after giving it up — swap them (A→manager, B→X).
//
// Same-shift role swaps keep coverage, who-works-which-day, rest, and satisfied-
// request counts invariant (requests key on day+shift, not role), so it reuses
// the validated move primitives. It never displaces a SENIOR manager and never
// drops the donor below their own target. 12h cells are never touched. Best-
// effort: an achmash may stay below target when no legal swap exists (e.g. too
// few manager slots to go around).
import type { DayMeta, EngineInput, ShiftKey } from './types'
import type { FillState } from './dayfill'
import { isSeniorForRole } from './scoring'
import { moveLegal, applyMove, type Move, type SlotRef } from './moves'

const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']

function slotRef(
  st: FillState,
  empId: string,
  day: number,
  shift: ShiftKey,
  roleId: string,
): SlotRef | null {
  const idx = st.committed[empId]?.findIndex(
    (a) => a.day === day && a.shift === shift && a.roleId === roleId && !a.is12h,
  )
  if (idx == null || idx < 0) return null
  return { empId, idx, a: st.committed[empId][idx] }
}

export function runManagerBalancePass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): void {
  const mgr = input.managerRoleId
  if (!mgr) return
  const empById = new Map(input.employees.map((e) => [e.id, e]))
  const holdsMgr = (id: string) => empById.get(id)?.roleIds.includes(mgr) ?? false
  // Manager shifts held (numerator, incl. any 12h manager window) and the target
  // = ceil(total shifts / 2). Both read from the live committed state.
  const mgrCount = (id: string) => (st.committed[id] ?? []).filter((a) => a.roleId === mgr).length
  const target = (id: string) => Math.ceil((st.committed[id]?.length ?? 0) / 2)

  for (const d of input.days) {
    const day = d.index
    let changed = true
    let guard = 0
    while (changed && guard++ < 50) {
      changed = false
      const byShift = st.grid[day]
      if (!byShift) break
      for (const shift of BASE_SHIFTS) {
        const byRole = byShift[shift]
        const mgrHolders = byRole?.[mgr]
        if (!byRole || !mgrHolders || mgrHolders.length === 0) continue
        let done = false
        // A: a manager-holder BELOW target, currently in a non-manager role X here.
        for (const roleX of Object.keys(byRole)) {
          if (roleX === mgr) continue
          for (const aId of [...byRole[roleX]]) {
            if (!holdsMgr(aId) || mgrCount(aId) >= target(aId)) continue
            const legA = slotRef(st, aId, day, shift, roleX)
            if (!legA) continue
            // B: a non-senior manager-slot holder we can displace into roleX,
            // who stays at/above their OWN target after giving up one manager shift.
            for (const bId of [...mgrHolders]) {
              if (bId === aId) continue
              const bEmp = empById.get(bId)
              if (!bEmp || isSeniorForRole(bEmp, mgr)) continue
              if (mgrCount(bId) - 1 < target(bId)) continue
              const legB = slotRef(st, bId, day, shift, mgr)
              if (!legB) continue
              const move: Move = { legs: [legB, legA] } // B→roleX, A→manager
              if (moveLegal(input, metas, st, move)) {
                applyMove(st, move)
                changed = true
                done = true
                break
              }
            }
            if (done) break
          }
          if (done) break
        }
        if (changed) break
      }
    }
  }
}
