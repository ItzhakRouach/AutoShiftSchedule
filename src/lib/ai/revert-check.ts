// Re-check an AI revert against the hard rules before it is written.
//
// `planRevert` proves the AI's cells are still where the AI left them, but the
// manager may have edited OTHER cells since (e.g. put the worker on the night
// before), so restoring the old placement could now break rest, one-per-day or
// a day off. Each inverse swap is therefore replayed through `moveLegal` on the
// week as saved. Requests are not gated: putting the week back is the
// manager's explicit choice. Pure.
import type { EngineInput, ShiftKey } from '@/lib/scheduling/types'
import type { FillState } from '@/lib/scheduling/dayfill'
import { moveLegal, applyMove, type SlotRef } from '@/lib/scheduling/moves'

export interface EngineSide {
  employeeId: string
  day: number
  shift: ShiftKey
  role: string
}

const anyRequests = () => true

/** Only a plain 8h row can be a swap leg — 12h blocks are never moved. */
function ref(st: FillState, s: EngineSide): SlotRef | null {
  const rows = st.committed[s.employeeId] ?? []
  const idx = rows.findIndex((a) => a.day === s.day && a.shift === s.shift && a.roleId === s.role && !a.is12h)
  return idx < 0 ? null : { empId: s.employeeId, idx, a: rows[idx] }
}

/** True when every swap in `plan` (run in order) is legal. Mutates `st`. */
export function revertLegal(input: EngineInput, st: FillState, plan: { a: EngineSide; b: EngineSide }[]): boolean {
  const metas = Object.fromEntries(input.days.map((d) => [d.index, d]))
  for (const sw of plan) {
    const a = ref(st, sw.a)
    const b = ref(st, sw.b)
    if (!a || !b) return false
    const move = { legs: [a, b] }
    if (!moveLegal(input, metas, st, move, { requestGate: anyRequests })) return false
    applyMove(st, move)
  }
  return true
}
