// Apply AI-proposed SWAPS to the engine's finished week.
//
// This is the reframed second-opinion generator. Generating a week from scratch
// made the model re-solve a constraint problem the engine already solves well,
// and it lost (62/63 coverage, 6 below-minimum vs the engine's 3). Swapping
// instead bounds the AI to "better or equal":
//
//   * a swap exchanges the OCCUPANTS of two already-filled cells, so coverage
//     is invariant BY CONSTRUCTION — nothing can be left unstaffed;
//   * every swap must pass the engine's `moveLegal` (all 8 hard constraints,
//     re-checked for both movers against their state minus the vacated cell);
//   * and it is kept only if the overall score STRICTLY improves, by the same
//     comparator used for the side-by-side, so a swap cannot trade coverage or
//     a minimum away for a granted request.
//
// Each swap is tried on a clone, so a rejected one leaves no trace.
import type { EngineInput } from '@/lib/scheduling/types'
import type { FillState } from '@/lib/scheduling/dayfill'
import { resultFromFillState } from '@/lib/scheduling'
import { moveLegal, applyMove, type Move, type SlotRef } from '@/lib/scheduling/moves'
import { preservesRequestFloorFor } from '@/lib/scheduling/request-gate'
import { CODE_SHIFT } from './encode-week'
import { buildKeyMaps } from './keys'
import { scoreSchedule, compareScores } from './score'

export interface SwapCell {
  emp: string
  day: number
  shift: string
  role: string
}

export interface ProposedSwap {
  a: SwapCell
  b: SwapCell
  why?: string
}

export type SwapRejection =
  | 'unknown_employee'
  | 'unknown_role'
  | 'bad_shift'
  | 'no_such_cell'
  | 'illegal'
  | 'not_an_improvement'

export interface SwapOutcome {
  applied: number
  /** The swaps that passed both gates, so the apply step can replay them
   *  server-side against a freshly rebuilt base instead of trusting the
   *  client with a schedule. `accepted.length === applied` always. */
  accepted: ProposedSwap[]
  rejected: { swap: ProposedSwap; reason: SwapRejection }[]
}

const cloneState = (st: FillState): FillState => ({
  ...st,
  grid: JSON.parse(JSON.stringify(st.grid)),
  committed: Object.fromEntries(
    Object.entries(st.committed).map(([k, v]) => [k, v.map((a) => ({ ...a }))]),
  ),
  satisfied: { ...st.satisfied },
  twelve: st.twelve ? st.twelve.map((t) => ({ ...t })) : st.twelve,
})

/** Find the employee's own committed 8h row for this cell. 12h rows are never
 *  swap legs — the 12h pass owns them. */
function findRef(st: FillState, empId: string, cell: { day: number; shift: string; role: string }): SlotRef | null {
  const shift = CODE_SHIFT[cell.shift]
  const rows = st.committed[empId] ?? []
  const idx = rows.findIndex(
    (a) => a.day === cell.day && a.shift === shift && a.roleId === cell.role && !a.is12h,
  )
  return idx < 0 ? null : { empId, idx, a: rows[idx] }
}

export function applySwaps(
  input: EngineInput,
  st: FillState,
  swaps: ProposedSwap[],
): SwapOutcome {
  const maps = buildKeyMaps(input)
  const rejected: SwapOutcome['rejected'] = []
  const accepted: ProposedSwap[] = []
  let applied = 0

  type Resolved =
    | { ok: true; empId: string; role: string }
    | { ok: false; err: SwapRejection }

  const resolve = (c: SwapCell): Resolved => {
    const empId = maps.empId(c.emp)
    if (!empId) return { ok: false, err: 'unknown_employee' }
    const role = maps.roleId(c.role)
    if (!role) return { ok: false, err: 'unknown_role' }
    if (!CODE_SHIFT[c.shift]) return { ok: false, err: 'bad_shift' }
    return { ok: true, empId, role }
  }

  for (const swap of swaps) {
    const ra = resolve(swap.a)
    const rb = resolve(swap.b)
    if (!ra.ok) { rejected.push({ swap, reason: ra.err }); continue }
    if (!rb.ok) { rejected.push({ swap, reason: rb.err }); continue }

    const trial = cloneState(st)
    const legA = findRef(trial, ra.empId, { ...swap.a, role: ra.role })
    const legB = findRef(trial, rb.empId, { ...swap.b, role: rb.role })
    if (!legA || !legB) { rejected.push({ swap, reason: 'no_such_cell' }); continue }
    if (legA.empId === legB.empId && legA.idx === legB.idx) {
      rejected.push({ swap, reason: 'not_an_improvement' }); continue
    }

    const metas = Object.fromEntries(input.days.map((d) => [d.index, d]))
    const move: Move = { legs: [legA, legB] }
    // The relaxed gate lets a swap spend a granted request; the score check
    // below is what decides whether that trade was actually worth it.
    if (!moveLegal(input, metas, trial, move, { requestGate: preservesRequestFloorFor })) {
      rejected.push({ swap, reason: 'illegal' }); continue
    }

    const before = scoreSchedule(input, resultFromFillState(input, st))
    applyMove(trial, move)
    const after = scoreSchedule(input, resultFromFillState(input, trial))
    if (compareScores(after, before) >= 0) {
      rejected.push({ swap, reason: 'not_an_improvement' }); continue
    }

    // Commit the trial into the live state.
    st.grid = trial.grid
    st.committed = trial.committed
    st.satisfied = trial.satisfied
    accepted.push(swap)
    applied++
  }

  return { applied, accepted, rejected }
}
