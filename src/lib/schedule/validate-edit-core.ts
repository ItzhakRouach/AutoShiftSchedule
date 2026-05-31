// PURE manual-assignment validation. NO Supabase/IO imports — unit-tested with
// plain objects. Reuses the engine's hard-constraint predicates for base shifts
// and absolute-hour rest math (SHIFT_META) for 12h variants.
import type { ShiftId } from '@/lib/domain/constants'
import {
  availabilityAllows,
  holdsRole,
  isOff,
  underMax,
  worksThatDay,
} from '@/lib/scheduling/constraints'
import { isSacredBlocked } from '@/lib/scheduling/shabbat-holiday'
import { TWELVE_HOUR_COVERS } from '@/lib/scheduling/fallback'
import { shiftInterval, gapBetween } from '@/lib/schedule/rest-util'
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

// Re-export for consumers that imported shiftInterval from here directly.
export { shiftInterval } from '@/lib/schedule/rest-util'

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

  if (!args.isTwelveHour) {
    // Base-shift checks: availability and Shabbat/holiday per single shift.
    if (!availabilityAllows(emp, meta.index, shiftKey as ShiftKey))
      return { ok: false, severity: 'hard', reason: 'העובד אינו זמין במשמרת זו' }
    if (isSacredBlocked(emp, meta, shiftKey as ShiftKey))
      return { ok: false, severity: 'hard', reason: 'חסום עקב שבת או חג' }
  } else {
    // 12h checks: validate EVERY covered base shift for Shabbat/holiday and
    // availability. A 12h variant spans two adjacent base shifts; if either is
    // blocked the whole block must be rejected.
    const covered = TWELVE_HOUR_COVERS[shiftKey as keyof typeof TWELVE_HOUR_COVERS]
    if (covered) {
      for (const baseShift of covered) {
        if (isSacredBlocked(emp, meta, baseShift as ShiftKey))
          return {
            ok: false,
            severity: 'hard',
            reason: 'משמרת 12 שעות חופפת לשבת/חג של העובד',
          }
        if (emp.availability !== null && !availabilityAllows(emp, meta.index, baseShift as ShiftKey))
          return {
            ok: false,
            severity: 'hard',
            reason: 'העובד אינו זמין במשמרת 12 שעות זו',
          }
      }
    }
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
