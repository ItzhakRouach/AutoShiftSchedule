// PURE candidate-status for the SwapEditor UI. Mirrors the server core for
// labeling only — the server re-validates authoritatively on submit. No IO.
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { shabbatBlocks } from '@/lib/scheduling/shabbat-holiday'
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

function interval(day: number, key: ShiftId): [number, number] {
  const m = SHIFT_META[key]
  const s = day * 24 + m.start
  return [s, s + m.hours]
}

function gap(a: [number, number], b: [number, number]): number {
  if (b[0] >= a[1]) return b[0] - a[1]
  if (a[0] >= b[1]) return a[0] - b[1]
  return -1
}

export interface CandArgs {
  emp: EmployeeEditMeta
  day: number
  shiftKey: ShiftId
  roleId: string
  minRestHours: number
  requestedPreferred?: ShiftId[]
}

export function candidateStatus(args: CandArgs): CandResult {
  const { emp, day, shiftKey, roleId, minRestHours } = args
  const out = (s: CandStatus, disabled: boolean): CandResult => ({ status: s, label: LABELS[s], disabled })

  if (!emp.roleIds.includes(roleId)) return out('role', true)
  if (emp.offDays.includes(day)) return out('unavailable', true)

  // Already assigned a DIFFERENT shift the same day → assigning here replaces it.
  const sameDay = emp.committed[day]
  if (sameDay != null && sameDay !== shiftKey) return out('assigned_other', false)

  const isTwelve = !BASE.has(shiftKey)
  if (!isTwelve) {
    if (emp.availability) {
      const allowed = emp.availability[day]
      if (!allowed || !allowed.includes(shiftKey)) return out('unavailable', true)
    }
    if (emp.observesShabbat && shabbatBlocks(day, shiftKey as 'morning' | 'noon' | 'night'))
      return out('unavailable', true)
  }

  const others = Object.entries(emp.committed).filter(([d]) => Number(d) !== day)
  if (others.length && emp.maxShifts != null && others.length >= emp.maxShifts)
    return out('rest', true)

  const mine = interval(day, shiftKey)
  for (const [d, key] of others) {
    if (gap(mine, interval(Number(d), key)) < minRestHours) return out('rest', true)
  }

  if ((args.requestedPreferred ?? []).includes(shiftKey)) return out('requested', false)
  return out('available', false)
}
