// Coverage-preserving SENIOR-ROLE pass. A worker marked SENIOR for a role
// should hold THAT role whenever they work a shift, in preference to a regular
// holder. The matcher only treats seniority as a per-slot tiebreak, so a senior
// can still end up in a different role of a shift while a regular holds their
// senior role. This pass fixes that with a same-shift role SWAP: if a regular
// holds role X in a shift and a SENIOR-for-X worker is in another role Y of the
// SAME shift, swap their cells (the senior takes X, the regular takes Y) — as
// long as the regular can legally hold Y. Reuses the validated move primitives,
// so coverage, who-works-which-day, rest, and request satisfaction are all
// preserved (a role swap keeps both in the same shift).
import type { DayMeta, EngineInput, ShiftKey } from './types'
import type { FillState } from './dayfill'
import { isSeniorForRole } from './scoring'
import { moveLegal, applyMove, type Move, type SlotRef } from './moves'

const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']

function slotRef(st: FillState, empId: string, day: number, shift: ShiftKey, roleId: string): SlotRef | null {
  const idx = st.committed[empId]?.findIndex(
    (a) => a.day === day && a.shift === shift && a.roleId === roleId && !a.is12h,
  )
  if (idx == null || idx < 0) return null
  return { empId, idx, a: st.committed[empId][idx] }
}

export function runSeniorRolePass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): void {
  const empById = new Map(input.employees.map((e) => [e.id, e]))

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
        if (!byRole) continue
        const roles = Object.keys(byRole)
        for (const roleX of roles) {
          for (const nId of [...byRole[roleX]]) {
            const nEmp = empById.get(nId)
            if (!nEmp || isSeniorForRole(nEmp, roleX)) continue // already senior in X → good
            const legN = slotRef(st, nId, day, shift, roleX)
            if (!legN || legN.a.is12h) continue
            // Find a SENIOR-for-X worker currently in a DIFFERENT role of this shift.
            let done = false
            for (const roleY of roles) {
              if (roleY === roleX) continue
              for (const sId of [...byRole[roleY]]) {
                const sEmp = empById.get(sId)
                if (!sEmp || !isSeniorForRole(sEmp, roleX)) continue
                const legS = slotRef(st, sId, day, shift, roleY)
                if (!legS || legS.a.is12h) continue
                const move: Move = { legs: [legS, legN] } // S→X, N→Y
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
        if (changed) break
      }
    }
  }
}
