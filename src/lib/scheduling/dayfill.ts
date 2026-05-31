// Per-day fill via bipartite max-matching (FIX 2) + request-reservation rounds
// (FIX 5). Pure. Processes days in input order; rest is checked against
// assignments already committed on earlier days.
//
// LIMITATION (documented per FIX 5): the global weekly optimum across rest +
// fairness + the >=2 request floor is NP-hard. We approximate with per-round,
// per-day max-matching driven by the FIX-4 candidate precedence. This makes the
// >=2 (else >=1) request floor hold whenever a per-round matching exists, and
// fully staffs any day that is feasible in isolation given prior commitments.
import type { Assignment, DayMeta, Employee, EngineInput, ShiftKey } from './types'
import { isAssignable, type CheckContext } from './constraints'
import { compareCandidates, type CandidateState } from './scoring'
import { maxMatch, type MatchSlot } from './matching'
import { BASE_SHIFTS } from './types'

export interface FillState {
  grid: Record<number, Record<ShiftKey, Record<string, string[]>>>
  committed: Record<string, Assignment[]>
  satisfied: Record<string, number>
  lotteryRank: Record<string, number>
}

function reqOf(input: EngineInput, empId: string, day: number) {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

function ctxFor(
  input: EngineInput,
  emp: Employee,
  meta: DayMeta,
  shift: ShiftKey,
  roleId: string,
  st: FillState,
): CheckContext {
  return {
    emp,
    meta,
    shift,
    roleId,
    request: reqOf(input, emp.id, meta.index),
    current: st.committed[emp.id],
    settings: input.settings,
  }
}

/** Open (still-unfilled) role-slots for a single day, in shift/role order. */
export function openSlotsForDay(input: EngineInput, st: FillState, day: number): MatchSlot[] {
  const slots: MatchSlot[] = []
  const dayReq = input.requirements[day]
  if (!dayReq) return slots
  for (const shift of BASE_SHIFTS) {
    const roleReq = dayReq[shift]
    if (!roleReq) continue
    for (const roleId of Object.keys(roleReq)) {
      const have = st.grid[day][shift][roleId].length
      for (let i = have; i < roleReq[roleId]; i++) slots.push({ day, shift, roleId })
    }
  }
  return slots
}

/** Candidate state for ordering, treating `requested` as "requests any open shift". */
function candState(
  input: EngineInput,
  emp: Employee,
  meta: DayMeta,
  st: FillState,
  openShifts: Set<ShiftKey>,
): CandidateState {
  const req = reqOf(input, emp.id, meta.index)
  const requested = req.preferred.some((s) => openShifts.has(s))
  return {
    emp,
    requested,
    mustAcceptRequested: emp.mustAccept && requested,
    current: st.committed[emp.id],
    requestsSatisfied: st.satisfied[emp.id],
    lotteryRank: st.lotteryRank[emp.id],
  }
}

/** Employees ordered by FIX-4 precedence for this day's open slots. */
export function orderedEmployees(
  input: EngineInput,
  meta: DayMeta,
  st: FillState,
  slots: MatchSlot[],
): Employee[] {
  const openShifts = new Set<ShiftKey>(slots.map((s) => s.shift))
  return input.employees
    .slice()
    .sort((a, b) =>
      compareCandidates(
        candState(input, a, meta, st, openShifts),
        candState(input, b, meta, st, openShifts),
      ),
    )
}

/** CandidateState for a SPECIFIC slot (requested = requests that exact shift). */
function slotCandState(
  input: EngineInput,
  e: Employee,
  meta: DayMeta,
  st: FillState,
  slot: MatchSlot,
): CandidateState {
  const requested = reqOf(input, e.id, slot.day).preferred.includes(slot.shift)
  return {
    emp: e,
    requested,
    mustAcceptRequested: e.mustAccept && requested,
    current: st.committed[e.id],
    requestsSatisfied: st.satisfied[e.id],
    lotteryRank: st.lotteryRank[e.id],
  }
}

/**
 * Is `e` a top-precedence (non-dominated) candidate for `slot` among ALL
 * assignable employees (per FIX-4 ordering)? Used in the reservation pre-pass so
 * a lower-tier requester cannot reserve a contended slot ahead of a higher-tier
 * employee (honors "full-time first" while still reserving requested slots).
 */
export function isTopPrecedenceFor(
  input: EngineInput,
  meta: DayMeta,
  st: FillState,
  e: Employee,
  slot: MatchSlot,
): boolean {
  const eCs = slotCandState(input, e, meta, st, slot)
  for (const o of input.employees) {
    if (o.id === e.id) continue
    if (!isAssignable(ctxFor(input, o, meta, slot.shift, slot.roleId, st))) continue
    if (compareCandidates(eCs, slotCandState(input, o, meta, st, slot)) > 0) return false
  }
  return true
}

function commit(input: EngineInput, st: FillState, empId: string, slot: MatchSlot): void {
  st.grid[slot.day][slot.shift][slot.roleId].push(empId)
  st.committed[empId].push({ employeeId: empId, day: slot.day, shift: slot.shift, roleId: slot.roleId })
  if (reqOf(input, empId, slot.day).preferred.includes(slot.shift)) st.satisfied[empId]++
}

/**
 * Fill one day's open slots via max-matching, restricting candidate slots with
 * `slotFilter` (e.g. only requested slots in a reservation round) and capping
 * per-employee capacity with `capacityOf` (1 for general fill).
 */
export function matchDay(
  input: EngineInput,
  meta: DayMeta,
  st: FillState,
  capacityOf: (e: Employee) => number,
  slotFilter: (e: Employee, slot: MatchSlot) => boolean,
): void {
  const slots = openSlotsForDay(input, st, meta.index)
  if (slots.length === 0) return
  const ordered = orderedEmployees(input, meta, st, slots)
  const eligible = (e: Employee, slot: MatchSlot): boolean =>
    slotFilter(e, slot) && isAssignable(ctxFor(input, e, meta, slot.shift, slot.roleId, st))
  const res = maxMatch<Employee>({
    slots,
    employees: ordered,
    idOf: (e) => e.id,
    capacityOf,
    eligible: (e, slot) => eligible(e, slot),
  })
  // Apply matches deterministically in slot order.
  for (let si = 0; si < slots.length; si++) {
    const empId = res.assignment.get(si)
    if (empId != null) commit(input, st, empId, slots[si])
  }
}
