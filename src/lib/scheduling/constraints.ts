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
import { restOk } from './rest'
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

/** 6. Rest between this shift and every committed shift. */
export function restSatisfied(ctx: CheckContext): boolean {
  return ctx.current.every((a) =>
    restOk(a.day, a.shift, ctx.meta.index, ctx.shift, ctx.settings.minRestHours),
  )
}

/** 7. One shift per employee per day. */
export function worksThatDay(current: Assignment[], day: number): boolean {
  return current.some((a) => a.day === day)
}

/** 8. Never exceed maxShifts (if set). */
export function underMax(emp: Employee, current: Assignment[]): boolean {
  return emp.maxShifts == null || current.length < emp.maxShifts
}

/** All hard constraints combined. Returns true if the assignment is legal. */
export function isAssignable(ctx: CheckContext): boolean {
  if (!holdsRole(ctx.emp, ctx.roleId)) return false
  if (isOff(ctx.request)) return false
  if (!availabilityAllows(ctx.emp, ctx.meta.index, ctx.shift)) return false
  if (isSacredBlocked(ctx.emp, ctx.meta, ctx.shift)) return false
  if (worksThatDay(ctx.current, ctx.meta.index)) return false
  if (!underMax(ctx.emp, ctx.current)) return false
  if (!restSatisfied(ctx)) return false
  return true
}
