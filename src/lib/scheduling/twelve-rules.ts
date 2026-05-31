// Hard-constraint check for assigning a 12h shift to an employee. Pure.
//
// All base hard constraints still apply to a 12h:
//  - off request → blocked
//  - one shift per day (no other shift the same day)
//  - maxShifts
//  - availability: EVERY window the 12h touches must be allowed (TWELVE_HOUR_COVERS)
//  - Shabbat/holiday: blocked if ANY touched window is sacred-blocked for an observer
//  - rest >= minRest using the 12h's REAL duration vs every other committed shift
// (role match is validated per covered base shift by the caller's planCover.)
import { SHIFT_META } from '@/lib/domain/constants'
import type {
  Assignment,
  DayMeta,
  DayRequest,
  Employee,
  Settings,
  TwelveHourKey,
} from './types'
import { isOff, worksThatDay, underMax, availabilityAllows } from './constraints'
import { isSacredBlocked } from './shabbat-holiday'
import { TWELVE_HOUR_COVERS } from './fallback'
import { shiftStartAbs, shiftEndAbs } from './rest'

export interface TwelveCtx {
  emp: Employee
  meta: DayMeta
  variant: TwelveHourKey
  request: DayRequest
  current: Assignment[]
  settings: Settings
}

/** Absolute [start, end) the 12h variant occupies on `day`. */
function interval(variant: TwelveHourKey, day: number): [number, number] {
  const m = SHIFT_META[variant]
  const start = day * 24 + m.start
  return [start, start + m.hours]
}

/** Rest gap (hrs) between the 12h block and a committed base/12h assignment. */
function gapToCommitted(vs: number, ve: number, a: Assignment): number {
  const asAbs = a.is12h && a.variant ? interval(a.variant, a.day)[0] : shiftStartAbs(a.day, a.shift)
  const aeAbs = a.is12h && a.variant ? interval(a.variant, a.day)[1] : shiftEndAbs(a.day, a.shift)
  if (vs >= aeAbs) return vs - aeAbs
  if (asAbs >= ve) return asAbs - ve
  return -1
}

export function canTwelve(ctx: TwelveCtx): boolean {
  if (isOff(ctx.request)) return false
  if (worksThatDay(ctx.current, ctx.meta.index)) return false
  if (!underMax(ctx.emp, ctx.current)) return false

  const touched = TWELVE_HOUR_COVERS[ctx.variant]
  for (const shift of touched) {
    if (isSacredBlocked(ctx.emp, ctx.meta, shift)) return false
    if (ctx.emp.availability !== null && !availabilityAllows(ctx.emp, ctx.meta.index, shift)) return false
  }

  const [vs, ve] = interval(ctx.variant, ctx.meta.index)
  for (const a of ctx.current) {
    if (gapToCommitted(vs, ve, a) < ctx.settings.minRestHours) return false
  }
  return true
}
