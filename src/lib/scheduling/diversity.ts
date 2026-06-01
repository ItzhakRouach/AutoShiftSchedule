// Coverage-preserving diversity post-pass (pure, deterministic). Finishes the
// two SLOT-SPECIFIC fairness dimensions that a per-DAY employee ordering cannot
// fully control:
//   2. Shift-type variety per employee (don't strand someone on one type).
//   4. Co-worker rotation (vary who works alongside whom).
//
// MECHANISM. After the 8h general fill, repeatedly look for a pair of committed
// 8h assignments held by two DIFFERENT employees and SWAP their employees. A swap
// keeps every slot filled (coverage is byte-for-byte identical — only WHO fills
// each slot changes) and is applied ONLY when (a) both employees stay legal under
// all 8 hard constraints in their new slot and (b) it STRICTLY lowers a global
// monotony objective. Deterministic scan order + a strict-decrease rule + a fixed
// iteration cap guarantee termination and reproducibility. The higher soft
// objectives are untouched: swaps never change any employee's total shift count,
// so even-load, reach-min, requested and the request floor are all preserved.
//
// CO-WORKER definition: two employees "worked together" iff assigned to the SAME
// day AND SAME shift (the same physical shift block). The repetition penalty is
// the number of EXTRA shared shifts beyond the first for each pair (sum over
// pairs of max(0, sharedCount − 1)).
import type { Assignment, DayMeta, Employee, EngineInput, ShiftKey } from './types'
import type { FillState } from './dayfill'
import { isAssignable, type CheckContext } from './constraints'
import { typeSpread } from './fairness'

const MAX_PASSES = 24

function reqOf(input: EngineInput, empId: string, day: number) {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

/** Hard-constraint check for `emp` taking (day,shift,role) given `current`
 *  (which must already EXCLUDE the assignment being vacated). */
function legal(
  input: EngineInput,
  emp: Employee,
  meta: DayMeta,
  shift: ShiftKey,
  roleId: string,
  current: Assignment[],
): boolean {
  const ctx: CheckContext = {
    emp,
    meta,
    shift,
    roleId,
    request: reqOf(input, emp.id, meta.index),
    current,
    settings: input.settings,
  }
  return isAssignable(ctx)
}

/** Global monotony objective: sum of per-employee type-spread (dim 2) plus the
 *  co-worker repetition penalty (dim 4). Lower = more diverse. Pure. */
export function diversityCost(
  employees: Employee[],
  committed: Record<string, Assignment[]>,
): number {
  let spread = 0
  for (const e of employees) spread += typeSpread(committed[e.id])
  // co-worker pairs sharing the same day+shift
  const groups = new Map<string, string[]>()
  for (const e of employees) {
    for (const a of committed[e.id]) {
      const key = `${a.day}|${a.shift}`
      const list = groups.get(key) ?? []
      list.push(e.id)
      groups.set(key, list)
    }
  }
  const pairCount = new Map<string, number>()
  for (const ids of groups.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [x, y] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]]
        const k = `${x}|${y}`
        pairCount.set(k, (pairCount.get(k) ?? 0) + 1)
      }
    }
  }
  let repeat = 0
  for (const c of pairCount.values()) repeat += Math.max(0, c - 1)
  return spread + repeat
}

/** Only plain 8h assignments are swap candidates; 12h coverage is left intact. */
function plain(a: Assignment): boolean {
  return !a.is12h
}

/** Apply a swap of employees between assignments i (of empA) and j (of empB)
 *  in-place on committed + grid. Both keep their role/day/shift cell, only the
 *  occupant id changes. */
function applySwap(
  st: FillState,
  empA: string,
  ai: number,
  empB: string,
  bj: number,
): void {
  const a = st.committed[empA][ai]
  const b = st.committed[empB][bj]
  // grid: replace ids in each cell
  const cellA = st.grid[a.day][a.shift][a.roleId]
  const cellB = st.grid[b.day][b.shift][b.roleId]
  cellA[cellA.indexOf(empA)] = empB
  cellB[cellB.indexOf(empB)] = empA
  // committed: build the moved assignments with the new employeeId
  st.committed[empA][ai] = { ...b, employeeId: empA }
  st.committed[empB][bj] = { ...a, employeeId: empB }
}

/** Would swapping these two assignments keep BOTH employees hard-legal? The
 *  vacated slot is removed from each employee's `current` before re-checking. */
function swapLegal(
  input: EngineInput,
  metas: Record<number, DayMeta>,
  st: FillState,
  empA: string,
  a: Assignment,
  empB: string,
  b: Assignment,
): boolean {
  const eA = input.employees.find((e) => e.id === empA)!
  const eB = input.employees.find((e) => e.id === empB)!
  const restA = st.committed[empA].filter((x) => x !== a)
  const restB = st.committed[empB].filter((x) => x !== b)
  return (
    legal(input, eA, metas[b.day], b.shift, b.roleId, restA) &&
    legal(input, eB, metas[a.day], a.shift, a.roleId, restB)
  )
}

/**
 * Run the coverage-preserving diversity post-pass, mutating `st`. Repeats a
 * deterministic scan of all committed-8h assignment pairs, applying the first
 * strictly-improving legal swap each pass, until no improvement or the cap.
 */
export function runDiversityPass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): void {
  const ids = input.employees.map((e) => e.id) // input order = deterministic
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = diversityCost(input.employees, st.committed)
    let best: { ia: number; ib: number; ai: number; bj: number; cost: number } | null = null
    for (let ia = 0; ia < ids.length; ia++) {
      const empA = ids[ia]
      for (let ib = ia + 1; ib < ids.length; ib++) {
        const empB = ids[ib]
        for (let ai = 0; ai < st.committed[empA].length; ai++) {
          const a = st.committed[empA][ai]
          if (!plain(a)) continue
          for (let bj = 0; bj < st.committed[empB].length; bj++) {
            const b = st.committed[empB][bj]
            if (!plain(b)) continue
            if (a.day === b.day) continue // constraint 7: one shift/day
            if (a.shift === b.shift && a.roleId === b.roleId) continue // no-op-ish
            if (!swapLegal(input, metas, st, empA, a, empB, b)) continue
            applySwap(st, empA, ai, empB, bj)
            const after = diversityCost(input.employees, st.committed)
            applySwap(st, empA, ai, empB, bj) // revert; only the best is applied
            // Strict-decrease + deterministic tie-break (first in scan order wins).
            if (after < before && (best === null || after < best.cost)) {
              best = { ia, ib, ai, bj, cost: after }
            }
          }
        }
      }
    }
    if (!best) break
    applySwap(st, ids[best.ia], best.ai, ids[best.ib], best.bj)
  }
}
