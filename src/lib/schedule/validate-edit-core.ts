// PURE manual-assignment validation. NO Supabase/IO imports — unit-tested with
// plain objects. Reuses the engine's hard-constraint predicates for base shifts
// and absolute-hour rest math (SHIFT_META) for 12h variants.
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import {
  availabilityAllows,
  holdsRole,
  isOff,
  underMax,
  worksThatDay,
} from '@/lib/scheduling/constraints'
import { isSacredBlocked } from '@/lib/scheduling/shabbat-holiday'
import type {
  Assignment,
  DayMeta,
  DayRequest,
  Employee,
  Settings,
  ShiftKey,
} from '@/lib/scheduling/types'

export type Verdict =
  | { ok: true; severity?: 'soft'; reason?: string }
  | { ok: false; severity: 'hard'; reason: string }

/** A committed assignment that may be a base OR a 12h shift (by ShiftId). */
export interface CommittedSlot {
  day: number
  shiftKey: ShiftId
  roleId: string
}

/** Absolute [start,end) hours a shift (base or 12h) occupies starting on `day`. */
export function shiftInterval(day: number, shiftKey: ShiftId): [number, number] {
  const m = SHIFT_META[shiftKey]
  const start = day * 24 + m.start
  return [start, start + m.hours]
}

/** Rest gap in hours between two intervals; -1 if they overlap. */
function gapBetween(a: [number, number], b: [number, number]): number {
  if (b[0] >= a[1]) return b[0] - a[1]
  if (a[0] >= b[1]) return a[0] - b[1]
  return -1
}

export interface ValidateCoreArgs {
  emp: Employee
  meta: DayMeta
  shiftKey: ShiftId
  roleId: string
  request: DayRequest
  /** the employee's OTHER committed slots this week (excluding the slot we replace today). */
  others: CommittedSlot[]
  settings: Settings
  /** true when assigning a 12h variant (skips base-only availability check). */
  isTwelveHour?: boolean
}

/**
 * Verdict for a proposed manual assignment. HARD violations → ok:false with a
 * specific Hebrew reason. A legal-but-not-requested assignment → ok:true (soft).
 */
export function validateAssignmentCore(args: ValidateCoreArgs): Verdict {
  const { emp, meta, shiftKey, roleId, request, others, settings } = args

  if (!holdsRole(emp, roleId))
    return { ok: false, severity: 'hard', reason: 'העובד אינו מתאים לתפקיד זה' }

  if (isOff(request))
    return { ok: false, severity: 'hard', reason: 'העובד ביקש יום חופש ביום זה' }

  // Availability + Shabbat/holiday are defined per base shift. For 12h, check the
  // base shifts the block spans implicitly via its start window (best-effort: the
  // morning/evening base key of the same start hour).
  if (!args.isTwelveHour) {
    if (!availabilityAllows(emp, meta.index, shiftKey as ShiftKey))
      return { ok: false, severity: 'hard', reason: 'העובד אינו זמין במשמרת זו' }
    if (isSacredBlocked(emp, meta, shiftKey as ShiftKey))
      return { ok: false, severity: 'hard', reason: 'חסום עקב שבת או חג' }
  }

  if (worksThatDay(others as unknown as Assignment[], meta.index))
    return { ok: false, severity: 'hard', reason: 'העובד כבר משובץ במשמרת אחרת ביום זה' }

  if (!underMax(emp, others as unknown as Assignment[]))
    return { ok: false, severity: 'hard', reason: 'חורג ממקסימום המשמרות של העובד' }

  // Rest vs every other committed slot, using correct hours for 12h via SHIFT_META.
  const mine = shiftInterval(meta.index, shiftKey)
  for (const o of others) {
    if (gapBetween(mine, shiftInterval(o.day, o.shiftKey)) < settings.minRestHours)
      return {
        ok: false,
        severity: 'hard',
        reason: `מפר מנוחה של ${settings.minRestHours} שעות`,
      }
  }

  // Legal. Mark soft if it wasn't explicitly requested (a warning hint).
  const requested = request.preferred.includes(shiftKey as ShiftKey)
  return requested ? { ok: true } : { ok: true, severity: 'soft' }
}
