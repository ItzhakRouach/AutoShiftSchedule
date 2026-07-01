// Move primitives for the coverage-preserving diversity post-pass: 2-swaps and
// 3-cycle rotations of the OCCUPANTS of already-filled 8h cells. Every move
// preserves coverage (only WHO fills a cell changes, never how many), and is
// gated on all 8 hard constraints + request preservation. Pure helpers over
// FillState; mutation is applied only by the caller via `applyMove`.
import type { Assignment, DayMeta, Employee, EngineInput, ShiftKey } from './types'
import type { FillState } from './dayfill'
import { isAssignable, type CheckContext } from './constraints'
import { preservesRequestsFor } from './request-gate'

/** A reference to a committed 8h assignment: which employee holds it + its cell. */
export interface SlotRef {
  empId: string
  idx: number // index into st.committed[empId]
  a: Assignment
}

/** An ordered move: occupant of leg[k] moves into leg[(k+1)%n]'s cell. */
export interface Move {
  legs: SlotRef[]
}

function reqOf(input: EngineInput, empId: string, day: number) {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

function legal(
  input: EngineInput,
  emp: Employee,
  meta: DayMeta,
  shift: ShiftKey,
  roleId: string,
  current: Assignment[],
): boolean {
  const ctx: CheckContext = {
    emp, meta, shift, roleId,
    request: reqOf(input, emp.id, meta.index),
    current,
    settings: input.settings,
    priorTail: input.priorWeekTail?.[emp.id],
    nextHead: input.nextWeekHead?.[emp.id],
  }
  return isAssignable(ctx)
}

const empById = (input: EngineInput, id: string): Employee =>
  input.employees.find((e) => e.id === id)!

/** Plain 8h cell (12h coverage is never touched). */
export function plain(a: Assignment): boolean {
  return !a.is12h
}

/**
 * Is this n-cycle move legal? Occupant of legs[k] moves into legs[(k+1)%n]'s
 * cell. For each mover we re-validate ALL hard constraints against their
 * assignments EXCLUDING their vacated slot, and gate on request preservation.
 */
export function moveLegal(
  input: EngineInput,
  metas: Record<number, DayMeta>,
  st: FillState,
  move: Move,
): boolean {
  const n = move.legs.length
  for (let k = 0; k < n; k++) {
    const from = move.legs[k]
    const to = move.legs[(k + 1) % n]
    const emp = empById(input, from.empId)
    // committed state for this employee WITHOUT their vacated slot...
    const rest = st.committed[from.empId].filter((x) => x !== from.a)
    if (!legal(input, emp, metas[to.a.day], to.a.shift, to.a.roleId, rest)) return false
    // ...and the proposed full assignment set (rest + the cell they move into).
    const proposed = [...rest, { ...to.a, employeeId: from.empId }]
    if (!preservesRequestsFor(input, from.empId, st.committed[from.empId], proposed)) {
      return false
    }
  }
  return true
}

/**
 * The committed-assignment map AFTER applying `move`, WITHOUT mutating `st`
 * (used to score a candidate). Occupant of legs[k] moves into legs[(k+1)%n]'s
 * cell, so legs[k].empId's slot at legs[k].idx becomes legs[(k+1)%n]'s cell.
 */
export function projectedCommitted(
  st: FillState,
  move: Move,
): Record<string, Assignment[]> {
  const out: Record<string, Assignment[]> = {}
  // Shallow-copy only the lists we touch; cost reads all lists, so copy refs.
  for (const id of Object.keys(st.committed)) out[id] = st.committed[id]
  const n = move.legs.length
  for (let k = 0; k < n; k++) {
    const from = move.legs[k]
    out[from.empId] = out[from.empId].slice()
  }
  for (let k = 0; k < n; k++) {
    const from = move.legs[k]
    const to = move.legs[(k + 1) % n]
    out[from.empId][from.idx] = { ...to.a, employeeId: from.empId }
  }
  return out
}

/** Apply an n-cycle in place on grid + committed (the real mutation). */
export function applyMove(st: FillState, move: Move): void {
  const n = move.legs.length
  // Grid: cell legs[k].a, held by legs[k].empId, becomes held by the leg whose
  // TARGET is legs[k]'s cell, i.e. legs[(k-1+n)%n].empId.
  for (let k = 0; k < n; k++) {
    const cellRef = move.legs[k].a
    const cell = st.grid[cellRef.day][cellRef.shift][cellRef.roleId]
    cell[cell.indexOf(move.legs[k].empId)] = move.legs[(k - 1 + n) % n].empId
  }
  // Committed: legs[k].empId now holds legs[(k+1)%n]'s cell.
  for (let k = 0; k < n; k++) {
    const from = move.legs[k]
    const to = move.legs[(k + 1) % n]
    st.committed[from.empId][from.idx] = { ...to.a, employeeId: from.empId }
  }
}
