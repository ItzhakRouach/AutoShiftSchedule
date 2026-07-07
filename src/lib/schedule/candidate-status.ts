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
  | 'absent' // בהיעדרות (חופשה/מילואים/מחלה — hard)
  | 'assigned_other' // משובץ במשמרת אחרת
  | 'off_soft' // ביקש חופש (overridable — clickable)
  | 'role_override' // לא בתפקיד (overridable — clickable)
  | 'avail_override' // מחוץ לזמינות (overridable — clickable)
  | 'rest' // מפר מנוחה
  | 'unavailable' // לא זמין (Shabbat/holiday — hard)
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
  absent: 'בהיעדרות',
  assigned_other: 'משובץ במשמרת אחרת',
  off_soft: 'ביקש חופש',
  role_override: 'לא בתפקיד',
  avail_override: 'מחוץ לזמינות',
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

  // Approved absence (vacation/מילואים/מחלה) is the strongest block — the worker
  // is off that day, so never offer them (they'd read as "available" otherwise).
  if (emp.absentDays.includes(day)) return out('absent', true)

  // MANAGER AUTHORITY: role-mismatch, availability, and soft off-requests are all
  // OVERRIDABLE — the row stays CLICKABLE with a hint, mirroring the server. Only
  // Shabbat/holiday (observer) and rest/max remain hard-disabled below.
  const roleOverride = !emp.roleIds.includes(roleId)
  const softOff = emp.offDays.includes(day) && !(args.requestedPreferred ?? []).includes(shiftKey)

  // Already assigned ANYWHERE that day → one-shift-per-day means assigning here
  // MOVES them. The current cell's own occupants are excluded upstream (see
  // CandidateList), so any remaining same-day commitment is a different slot —
  // flag it (even same shift, different role) instead of showing "available".
  const sameDay = emp.committed[day]
  const sameDayOther = sameDay != null

  let availOverride = false
  const isTwelve = !BASE.has(shiftKey)
  if (!isTwelve) {
    if (emp.availability) {
      const allowed = emp.availability[day]
      if (!allowed || !allowed.includes(shiftKey)) availOverride = true
    }
    if (emp.observesShabbat && shabbatBlocks(day, shiftKey as 'morning' | 'noon' | 'night'))
      return out('unavailable', true)
    if (args.dayMeta) {
      const dm = args.dayMeta
      if (emp.observesShabbat && holidayBlocks({ index: day, ...dm }, shiftKey as 'morning' | 'noon' | 'night'))
        return out('unavailable', true)
    }
  } else {
    // 12h: Shabbat/holiday on any covered window stays hard; availability warns.
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
          if (!allowed || !allowed.includes(baseShift as ShiftId)) availOverride = true
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

  // Legal / overridable. Surface one representative hint (the server shows the
  // full combined warning on assign). All are clickable.
  if (sameDayOther) return out('assigned_other', false)
  if ((args.requestedPreferred ?? []).includes(shiftKey)) return out('requested', false)
  if (roleOverride) return out('role_override', false)
  if (availOverride) return out('avail_override', false)
  if (softOff) return out('off_soft', false)
  return out('available', false)
}
