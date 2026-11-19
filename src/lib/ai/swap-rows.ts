// DB-level shape of an AI swap, and the pure planning of its reversal.
//
// A swap is applied through the atomic `swap_assignments` RPC, one call per
// swap. Each side records the cell its worker held BEFORE the swap, in real
// ids, so the exact inverse can be replayed later ("בטל שינויי AI"). Pure.

export type RowSource = 'auto' | 'manual' | 'fallback_12h'

export interface SwapSide {
  employeeId: string
  day: number
  shiftTypeId: string
  roleId: string
  /** Source of the row that held this cell BEFORE the swap — what a revert
   *  restores, so the week comes back verbatim. */
  source: RowSource
}

/** Before: a.employeeId in cell a, b.employeeId in cell b. After: crossed. */
export interface DbSwap {
  a: SwapSide
  b: SwapSide
}

/** Arguments for `swap_assignments` that perform `sw`. An approved AI swap is
 *  written `manual` (as a drag-swap is), so regenerate keeps the manager's
 *  choice; a revert passes `restore` to put each cell's original source back. */
export function swapRpcArgs(periodId: string, sw: DbSwap, mode: 'manual' | 'restore') {
  const manual = mode === 'manual'
  return {
    p_period: periodId,
    a_employee: sw.a.employeeId,
    a_from_day: sw.a.day,
    a_to_day: sw.b.day,
    a_to_shift: sw.b.shiftTypeId,
    a_to_role: sw.b.roleId,
    a_source: manual ? 'manual' : sw.b.source,
    b_employee: sw.b.employeeId,
    b_from_day: sw.b.day,
    b_to_day: sw.a.day,
    b_to_shift: sw.a.shiftTypeId,
    b_to_role: sw.a.roleId,
    b_source: manual ? 'manual' : sw.a.source,
  }
}

/** The swap that undoes `sw`: same cells, occupants crossed back. */
export const invertSwap = (sw: DbSwap): DbSwap => ({
  a: { ...sw.a, employeeId: sw.b.employeeId },
  b: { ...sw.b, employeeId: sw.a.employeeId },
})

export interface HeldCell {
  shiftTypeId: string
  roleId: string
}

const k = (employeeId: string, day: number) => `${employeeId}|${day}`

/** Key the period's current rows by (employee, day) — one row per pair. */
export function heldCells(rows: { employee_id: string | null; day_of_week: number; shift_type_id: string; role_id: string }[]) {
  const m = new Map<string, HeldCell>()
  for (const r of rows) {
    if (r.employee_id) m.set(k(r.employee_id, r.day_of_week), { shiftTypeId: r.shift_type_id, roleId: r.role_id })
  }
  return m
}

/**
 * Inverses of `applied`, in the order to run them (last swap first), or null
 * when the week no longer looks exactly like the AI left it — then a blind
 * revert could clobber an edit made since, so it is refused instead. Each
 * inverse is checked against the week as the earlier inverses leave it.
 */
export function planRevert(current: Map<string, HeldCell>, applied: DbSwap[]): DbSwap[] | null {
  const sim = new Map(current)
  const plan: DbSwap[] = []
  for (const sw of [...applied].reverse()) {
    const inv = invertSwap(sw)
    for (const side of [inv.a, inv.b]) {
      const held = sim.get(k(side.employeeId, side.day))
      if (!held || held.shiftTypeId !== side.shiftTypeId || held.roleId !== side.roleId) return null
    }
    // Each worker's destination day must be free (one row per employee/day),
    // unless it is the very row they are vacating in this swap.
    if (inv.a.day !== inv.b.day) {
      if (sim.has(k(inv.a.employeeId, inv.b.day)) || sim.has(k(inv.b.employeeId, inv.a.day))) return null
    }
    sim.delete(k(inv.a.employeeId, inv.a.day))
    sim.delete(k(inv.b.employeeId, inv.b.day))
    sim.set(k(inv.a.employeeId, inv.b.day), { shiftTypeId: inv.b.shiftTypeId, roleId: inv.b.roleId })
    sim.set(k(inv.b.employeeId, inv.a.day), { shiftTypeId: inv.a.shiftTypeId, roleId: inv.a.roleId })
    plan.push(inv)
  }
  return plan
}
