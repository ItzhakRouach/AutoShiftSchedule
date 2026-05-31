// Planning + commit primitives for the 12h auto-coverage pass. Pure helpers
// shared by twelve-fill.ts. Kept separate to honour the ≤200-line/file rule.
import type {
  Assignment,
  EngineInput,
  Employee,
  ShiftKey,
  TwelveHourAssignment,
  TwelveHourKey,
} from './types'
import type { FillState } from './dayfill'
import { TWELVE_HOUR_FILLS } from './fallback'

export interface Plan {
  rolesByShift: TwelveHourAssignment['rolesByShift']
  /** the employee's existing same-day base 8h shift this 12h absorbs, if any. */
  absorb: Assignment | null
}

export function reqOf(input: EngineInput, empId: string, day: number) {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

/** Uncovered count for (day, shift, role) given current grid. */
export function gap(input: EngineInput, st: FillState, day: number, shift: ShiftKey, role: string): number {
  const need = input.requirements[day]?.[shift]?.[role] ?? 0
  const have = st.grid[day][shift][role].length
  return Math.max(0, need - have)
}

/** All (shift, role) pairs with a remaining gap on `day`, in deterministic order. */
export function openPairs(input: EngineInput, st: FillState, day: number): { shift: ShiftKey; role: string }[] {
  const out: { shift: ShiftKey; role: string }[] = []
  const dayReq = input.requirements[day]
  if (!dayReq) return out
  for (const shift of ['morning', 'noon', 'night'] as ShiftKey[]) {
    const roleReq = dayReq[shift]
    if (!roleReq) continue
    for (const role of Object.keys(roleReq)) {
      if (gap(input, st, day, shift, role) > 0) out.push({ shift, role })
    }
  }
  return out
}

/** The employee's current same-day base (non-12h) assignment, or null. */
export function sameDayBase(st: FillState, e: Employee, day: number): Assignment | null {
  return st.committed[e.id].find((a) => a.day === day && !a.is12h) ?? null
}

/**
 * Decide which (shift→role) a 12h `variant` for `e` would fill. For each base
 * shift the variant FILLS: if `e` already holds a same-day 8h in one of these
 * windows the 12h ABSORBS it (keeps that role) and extends to cover an additional
 * open window; otherwise it fills any still-open (shift, role) `e` qualifies for.
 * Cross-role allowed (roles may differ per window). Returns null if it covers no
 * NEW gap.
 */
export function planCover(
  input: EngineInput,
  st: FillState,
  e: Employee,
  day: number,
  variant: TwelveHourKey,
): Plan | null {
  const fills = TWELVE_HOUR_FILLS[variant]
  const base = sameDayBase(st, e, day)
  const absorb = base && fills.includes(base.shift) ? base : null
  if (base && !absorb) return null // committed elsewhere that day → cannot 12h here
  const plan: TwelveHourAssignment['rolesByShift'] = {}
  let newGaps = 0
  for (const shift of fills) {
    if (absorb && shift === absorb.shift) {
      plan[shift] = absorb.roleId
      continue
    }
    const roleReq = input.requirements[day]?.[shift]
    if (!roleReq) continue
    for (const role of Object.keys(roleReq)) {
      if (plan[shift]) break
      if (!e.roleIds.includes(role)) continue
      if (gap(input, st, day, shift, role) > 0) {
        plan[shift] = role
        newGaps++
      }
    }
  }
  return newGaps > 0 ? { rolesByShift: plan, absorb } : null
}

export function removeBase(st: FillState, a: Assignment): void {
  const cell = st.grid[a.day][a.shift][a.roleId]
  const gi = cell.indexOf(a.employeeId)
  if (gi >= 0) cell.splice(gi, 1)
  st.committed[a.employeeId] = st.committed[a.employeeId].filter((x) => x !== a)
}

/** Commit a planned 12h: mark each covered base cell + the canonical record. */
export function commitTwelve(
  st: FillState,
  out: TwelveHourAssignment[],
  e: Employee,
  day: number,
  variant: TwelveHourKey,
  plan: Plan,
): void {
  if (plan.absorb) removeBase(st, plan.absorb)
  for (const shift of Object.keys(plan.rolesByShift) as ShiftKey[]) {
    const role = plan.rolesByShift[shift]!
    st.grid[day][shift][role].push(e.id)
    st.committed[e.id].push({ employeeId: e.id, day, shift, roleId: role, is12h: true, variant })
  }
  out.push({ employeeId: e.id, day, variant, rolesByShift: plan.rolesByShift })
}
