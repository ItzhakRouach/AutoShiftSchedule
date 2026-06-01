// PURE candidate-status for the SwapEditor UI. Mirrors the server core for
// labeling only — the server re-validates authoritatively on submit. No IO.
import type { ShiftId } from '@/lib/domain/constants'
import { shabbatBlocks, holidayBlocks } from '@/lib/scheduling/shabbat-holiday'
import { TWELVE_HOUR_COVERS } from '@/lib/scheduling/fallback'
import { shiftInterval, gapBetween } from '@/lib/schedule/rest-util'
import type { EmployeeEditMeta } from './edit-meta'

export type CandStatus =
  | 'requested' // ✓ ביקש
  | 'available' // זמין
  | 'assigned_other' // משובץ במשמרת אחרת
  | 'rest' // מפר מנוחה
  | 'unavailable' // לא זמין
  | 'role' // אינו מתאים לתפקיד

export interface CandResult {
  status: CandStatus
  label: string
  /** hard-invalid → disabled in UI. */
  disabled: boolean
}

const LABELS: Record<CandStatus, string> = {
  requested: '✓ ביקש',
  available: 'זמין',
  assigned_other: 'משובץ במשמרת אחרת',
  rest: 'מפר מנוחה',
  unavailable: 'לא זמין',
  role: 'אינו מתאים לתפקיד',
}

const BASE = new Set(['morning', 'noon', 'night'])

export interface CandArgs {
  emp: EmployeeEditMeta
  day: number
  shiftKey: ShiftId
  roleId: string
  minRestHours: number
  requestedPreferred?: ShiftId[]
  /** For holiday checks: is this day a holiday eve / holiday? */
  dayMeta?: { isHolidayEve: boolean; isHoliday: boolean }
}

export function candidateStatus(args: CandArgs): CandResult {
  const { emp, day, shiftKey, roleId, minRestHours } = args
  const out = (s: CandStatus, disabled: boolean): CandResult => ({ status: s, label: LABELS[s], disabled })

  if (!emp.roleIds.includes(roleId)) return out('role', true)
  if (emp.offDays.includes(day)) return out('unavailable', true)

  // Already assigned a DIFFERENT shift the same day → assigning here REPLACES it.
  // We still must validate the proposed shift's own availability/sacred/rest/max
  // (against OTHER days) before surfacing the soft "replaces" label, otherwise an
  // actually-illegal pick (e.g. a 12h that under-rests an adjacent day) would look
  // selectable. We defer the label and only emit it if nothing harder fails.
  const sameDay = emp.committed[day]
  const sameDayOther = sameDay != null && sameDay !== shiftKey

  const isTwelve = !BASE.has(shiftKey)
  if (!isTwelve) {
    if (emp.availability) {
      const allowed = emp.availability[day]
      if (!allowed || !allowed.includes(shiftKey)) return out('unavailable', true)
    }
    if (emp.observesShabbat && shabbatBlocks(day, shiftKey as 'morning' | 'noon' | 'night'))
      return out('unavailable', true)
    if (args.dayMeta) {
      const dm = args.dayMeta
      if (emp.observesShabbat && holidayBlocks({ index: day, ...dm }, shiftKey as 'morning' | 'noon' | 'night'))
        return out('unavailable', true)
    }
  } else {
    // 12h: check every covered base shift for Shabbat/availability.
    const covered = TWELVE_HOUR_COVERS[shiftKey as keyof typeof TWELVE_HOUR_COVERS]
    if (covered) {
      for (const baseShift of covered) {
        const bs = baseShift as 'morning' | 'noon' | 'night'
        if (emp.observesShabbat && shabbatBlocks(day, bs)) return out('unavailable', true)
        if (args.dayMeta) {
          const dm = args.dayMeta
          if (emp.observesShabbat && holidayBlocks({ index: day, ...dm }, bs))
            return out('unavailable', true)
        }
        if (emp.availability) {
          const allowed = emp.availability[day]
          if (!allowed || !allowed.includes(baseShift as ShiftId)) return out('unavailable', true)
        }
      }
    }
  }

  const others = Object.entries(emp.committed).filter(([d]) => Number(d) !== day)
  if (others.length && emp.maxShifts != null && others.length >= emp.maxShifts)
    return out('rest', true)

  const mine = shiftInterval(day, shiftKey)
  for (const [d, key] of others) {
    if (gapBetween(mine, shiftInterval(Number(d), key as ShiftId)) < minRestHours) return out('rest', true)
  }

  // Legal. If it replaces a different same-day shift, surface that (soft) label.
  if (sameDayOther) return out('assigned_other', false)
  if ((args.requestedPreferred ?? []).includes(shiftKey)) return out('requested', false)
  return out('available', false)
}
