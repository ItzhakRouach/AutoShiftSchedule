// Coverage-preserving ROLE-BALANCE pass. Splits every NON-manager role's
// shifts evenly across its holders via same-shift role swaps (a giver's cell
// in role R trades with a receiver's same-day+shift cell in role X). The
// diversity pass cannot make these moves (its move shape bans same-day cells)
// and manager-balance only guards the manager role's own ≥50% ratio.
//
// Same-shift swaps keep coverage, who-works-which-day, rest, night counts and
// satisfied requests invariant (requests key on day+shift, not role). Manager-
// role cells are never a swap leg — the ≥50% rule owns them. Senior holders
// are never displaced from their senior role (either side). A swap is accepted
// only when it strictly decreases the GLOBAL per-role Σcount² potential, so
// evening out R can never just shuffle the pile into X (and the pass provably
// terminates).
import type { DayMeta, EngineInput } from './types'
import type { FillState } from './dayfill'
import { isSeniorForRole } from './scoring'
import { moveLegal, applyMove, type Move, type SlotRef } from './moves'

const MAX_PASSES = 200

export function runRoleBalancePass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): void {
  const mgr = input.managerRoleId
  const empById = new Map(input.employees.map((e) => [e.id, e]))
  const ids = Object.keys(st.committed).sort()
  const count = (id: string, role: string) =>
    st.committed[id].filter((a) => a.roleId === role && !a.is12h).length

  const roles = [...new Set(ids.flatMap((id) => st.committed[id].map((a) => a.roleId)))]
    .filter((r) => r !== mgr)
    .sort()

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false
    scan: for (const role of roles) {
      const holders = ids.filter((id) => empById.get(id)?.roleIds.includes(role))
      if (holders.length < 2) continue
      const givers = [...holders].sort((a, b) => count(b, role) - count(a, role) || (a < b ? -1 : 1))
      const receivers = [...holders].sort((a, b) => count(a, role) - count(b, role) || (a < b ? -1 : 1))
      for (const g of givers) {
        if (isSeniorForRole(empById.get(g)!, role)) continue
        for (const r of receivers) {
          if (r === g) continue
          if (count(g, role) - count(r, role) < 2) break // ascending → no later r closes the gap
          if (trySwap(input, st, metas, empById, mgr, role, g, r)) {
            moved = true
            break scan
          }
        }
      }
    }
    if (!moved) return
  }
}

/** Swap one of g's `role` cells with r's same-day+shift cell in another role. */
function trySwap(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
  empById: Map<string, EngineInput['employees'][number]>,
  mgr: string | undefined,
  role: string,
  g: string,
  r: string,
): boolean {
  const count = (id: string, roleId: string) =>
    st.committed[id].filter((a) => a.roleId === roleId && !a.is12h).length
  const gCells = st.committed[g]
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => a.roleId === role && !a.is12h)
    .sort((x, y) => x.a.day - y.a.day || (x.a.shift < y.a.shift ? -1 : 1))
  for (const gc of gCells) {
    const rIdx = st.committed[r].findIndex(
      (a) =>
        a.day === gc.a.day &&
        a.shift === gc.a.shift &&
        a.roleId !== role &&
        a.roleId !== mgr &&
        !a.is12h,
    )
    if (rIdx < 0) continue
    const rc = st.committed[r][rIdx]
    if (isSeniorForRole(empById.get(r)!, rc.roleId)) continue // r never leaves a senior role
    // Global balance must strictly improve: ΔΣcount² over BOTH touched roles.
    const delta =
      2 * (count(r, role) - count(g, role) + 1) + 2 * (count(g, rc.roleId) - count(r, rc.roleId) + 1)
    if (delta >= 0) continue
    const legG: SlotRef = { empId: g, idx: gc.idx, a: gc.a }
    const legR: SlotRef = { empId: r, idx: rIdx, a: rc }
    const move: Move = { legs: [legG, legR] } // g → r's cell, r → g's role cell
    if (moveLegal(input, metas, st, move)) {
      applyMove(st, move)
      return true
    }
  }
  return false
}
