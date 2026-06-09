// Hard constraints (must ALWAYS hold). Pure predicates over the current
// assignment state. Constraints 1–8 from the spec.
import type {
  Assignment,
  DayMeta,
  DayRequest,
  Employee,
  ShiftKey,
  Settings,
} from './types'
import { restOk, shiftStartAbs } from './rest'
import { isSacredBlocked } from './shabbat-holiday'

export interface CheckContext {
  emp: Employee
  meta: DayMeta
  shift: ShiftKey
  roleId: string
  request: DayRequest
  /** the employee's already-committed assignments this week */
  current: Assignment[]
  settings: Settings
  /**
   * Optional carry-over from the prior published week: list of END abs-hours of
   * the employee's prior-week shifts (current week day 0 = abs hour 0). Each
   * entry is checked vs the proposed shift's START abs hour for minRest.
   */
  priorTail?: number[]
}

/** 1. Role match. */
export function holdsRole(emp: Employee, roleId: string): boolean {
  return emp.roleIds.includes(roleId)
}

/** 2. Off request / vacation. */
export function isOff(request: DayRequest): boolean {
  return request.off
}

/** 3. Recurring availability (null profile = unrestricted). */
export function availabilityAllows(
  emp: Employee,
  day: number,
  shift: ShiftKey,
): boolean {
  if (emp.availability == null) return true
  const allowed = emp.availability[day]
  if (allowed == null) return false
  return allowed.includes(shift)
}

/** 6. Rest between this shift and every committed shift, INCLUDING the prior
 *  published week's tail (e.g. Saturday night → Sunday morning). */
export function restSatisfied(ctx: CheckContext): boolean {
  const sameWeek = ctx.current.every((a) =>
    restOk(a.day, a.shift, ctx.meta.index, ctx.shift, ctx.settings.minRestHours),
  )
  if (!sameWeek) return false
  if (!ctx.priorTail || ctx.priorTail.length === 0) return true
  const startAbs = shiftStartAbs(ctx.meta.index, ctx.shift)
  return ctx.priorTail.every((endAbs) => startAbs - endAbs >= ctx.settings.minRestHours)
}

/** 7. One shift per employee per day. */
export function worksThatDay(current: Assignment[], day: number): boolean {
  return current.some((a) => a.day === day)
}

/** 8. Never exceed maxShifts (if set). Counts distinct WORK DAYS, not raw
 *  assignment rows: a 12h shift pushes one row per covered base window
 *  (see commitTwelve), but it is ONE shift toward the weekly cap. One-shift-
 *  per-day (constraint 7) makes distinct days the correct shift count. */
export function underMax(emp: Employee, current: Assignment[]): boolean {
  if (emp.maxShifts == null) return true
  const days = new Set(current.map((a) => a.day))
  return days.size < emp.maxShifts
}

/** All hard constraints combined. Returns true if the assignment is legal.
 *  `allowSoftOff` lets the coverage-rescue pass place an employee who only
 *  REQUESTED off (soft) — a vacation/רענון (`offHard`) still blocks. */
export function isAssignable(
  ctx: CheckContext,
  opts: { allowSoftOff?: boolean } = {},
): boolean {
  if (!holdsRole(ctx.emp, ctx.roleId)) return false
  const offBlocks = isOff(ctx.request) && !(opts.allowSoftOff && !ctx.request.offHard)
  if (offBlocks) return false
  if (!availabilityAllows(ctx.emp, ctx.meta.index, ctx.shift)) return false
  if (isSacredBlocked(ctx.emp, ctx.meta, ctx.shift)) return false
  if (worksThatDay(ctx.current, ctx.meta.index)) return false
  if (!underMax(ctx.emp, ctx.current)) return false
  if (!restSatisfied(ctx)) return false
  return true
}
