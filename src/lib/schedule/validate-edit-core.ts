// PURE manual-assignment validation. NO Supabase/IO imports — unit-tested with
// plain objects. Reuses the engine's hard-constraint predicates for base shifts
// and absolute-hour rest math (SHIFT_META) for 12h variants.
import type { ShiftId } from '@/lib/domain/constants'
import {
  availabilityAllows,
  holdsRole,
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

/**
 * True when a (day × shift × role) slot already holds its full required
 * headcount, so no further employee may be added. Prevents over-filling a role
 * box — e.g. placing 2 people where the requirement is 1. `currentCount` should
 * EXCLUDE the employee being (re)assigned, so swapping a person within the same
 * slot is never blocked. A slot with `requiredCount` 0 is UNCONFIGURED for this
 * day → no upper cap, so the manager can still fill the empty cell (override).
 */
export function slotAtCapacity(currentCount: number, requiredCount: number): boolean {
  return requiredCount > 0 && currentCount >= requiredCount
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
  /** prior-published-week END abs hours of THIS employee's shifts (current week
   *  day 0 = abs hour 0). Optional; absent → no cross-week rest check. */
  priorTail?: number[]
  /** next-week START abs hours of THIS employee's shifts, expressed in the
   *  edited week's frame ((day+7)*24 + start_hour). Optional; absent → no
   *  cross-week-ahead rest check. */
  nextHead?: number[]
}

/**
 * Verdict for a proposed manual assignment. HARD violations → ok:false with a
 * specific Hebrew reason. A legal-but-not-requested assignment → ok:true (soft).
 */
export function validateAssignmentCore(args: ValidateCoreArgs): Verdict {
  const { emp, meta, shiftKey, roleId, request, others, settings } = args

  // MANAGER AUTHORITY: in manual editing, role-qualification and availability are
  // OVERRIDABLE — the manager may place a worker they judge capable, and we just
  // WARN. Hard blocks remain only for approved time-off (vacation/רענון/
  // must-accept), Shabbat/holiday for an observer, and the legal rest gap.
  const warnings: string[] = []

  if (!holdsRole(emp, roleId)) warnings.push('העובד אינו מחזיק בתפקיד זה')

  // Off handling MIRRORS the auto-engine (isAssignable): a MIXED request
  // (off + preferred shifts) keeps the worker available for a preferred shift;
  // a SOFT off (a plain worker off-request — NOT vacation/רענון/must-accept) is
  // overridable and surfaced as a warning. Only a HARD off blocks.
  const ruledOutByOff = request.off && !request.preferred.includes(shiftKey as ShiftKey)
  if (ruledOutByOff) {
    if (request.offHard)
      return { ok: false, severity: 'hard', reason: 'העובד בחופשה מאושרת / רענון ביום זה' }
    warnings.push('העובד ביקש חופש ביום זה')
  }

  if (!args.isTwelveHour) {
    // Base-shift: availability is overridable (warn); Shabbat/holiday stays hard.
    if (!availabilityAllows(emp, meta.index, shiftKey as ShiftKey))
      warnings.push('מחוץ לזמינות שהעובד ציין')
    if (isSacredBlocked(emp, meta, shiftKey as ShiftKey))
      return { ok: false, severity: 'hard', reason: 'חסום עקב שבת או חג' }
  } else {
    // 12h spans two adjacent base shifts. Shabbat/holiday on EITHER window stays
    // hard; availability is overridable (warn at most once).
    const covered = TWELVE_HOUR_COVERS[shiftKey as keyof typeof TWELVE_HOUR_COVERS]
    if (covered) {
      let availWarned = false
      for (const baseShift of covered) {
        if (isSacredBlocked(emp, meta, baseShift as ShiftKey))
          return {
            ok: false,
            severity: 'hard',
            reason: 'משמרת 12 שעות חופפת לשבת/חג של העובד',
          }
        if (!availWarned && !availabilityAllows(emp, meta.index, baseShift as ShiftKey)) {
          warnings.push('מחוץ לזמינות שהעובד ציין (משמרת 12 שעות)')
          availWarned = true
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
  // Cross-week rest: prior published week's tail (end abs hours, current week
  // day 0 = abs hour 0). Blocks e.g. Sat-night → Sun-morning when minRest ≥ 1.
  const priorTail = args.priorTail
  if (priorTail && priorTail.length > 0) {
    const startAbs = mine[0]
    for (const endAbs of priorTail) {
      if (startAbs - endAbs < settings.minRestHours)
        return {
          ok: false,
          severity: 'hard',
          reason: `מפר מנוחה של ${settings.minRestHours} שעות מול השבוע הקודם`,
        }
    }
  }
  // Cross-week rest, symmetric case: next week's head (start abs hours, in the
  // edited week's frame). Blocks e.g. Sat-night → next-Sun-morning.
  const nextHead = args.nextHead
  if (nextHead && nextHead.length > 0) {
    const myEnd = mine[1]
    for (const headStart of nextHead) {
      if (headStart - myEnd < settings.minRestHours)
        return {
          ok: false,
          severity: 'hard',
          reason: `מפר מנוחה של ${settings.minRestHours} שעות מול השבוע הבא`,
        }
    }
  }

  // Legal. Surface any override warnings (role / availability / soft-off) so the
  // manager sees what they overrode.
  if (warnings.length > 0)
    return { ok: true, severity: 'soft', reason: `${warnings.join(' · ')} — שובץ בכל זאת` }
  // Mark soft if it wasn't explicitly requested (a warning hint).
  const requested = request.preferred.includes(shiftKey as ShiftKey)
  return requested ? { ok: true } : { ok: true, severity: 'soft' }
}
