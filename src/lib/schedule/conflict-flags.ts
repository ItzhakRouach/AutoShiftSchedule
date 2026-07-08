// PURE conflict detection for the week table — surfaces min-rest breaches and
// over-max-shifts states that can arise from undo (restored without re-validation)
// or copy-last-week, so the manager sees them inline instead of only in the editor.
import type { ShiftId } from '@/lib/domain/constants'
import type { EditMeta } from './edit-meta'
import type { ScheduleView } from './view-data'
import { shiftInterval, gapBetween } from './rest-util'

export type ConflictReason = 'rest' | 'overmax'

const REASON_LABEL: Record<ConflictReason, string> = {
  rest: 'מנוחה קצרה מהמינימום בין משמרות',
  overmax: 'חריגה ממקסימום המשמרות לשבוע',
}

export function conflictLabel(reason: ConflictReason): string {
  return REASON_LABEL[reason]
}

/** One committed shift for an employee this week (base key or 12h variant). */
interface EmpShift { day: number; key: ShiftId }

/**
 * Map keyed `${day}:${employeeId}` → the worst conflict for that employee on
 * that day, derived from the CURRENT view (grid + 12h) so it stays live during
 * editing. `rest` outranks `overmax`. Returns an empty map for read-only views
 * (no editMeta) or when nothing is wrong.
 */
export function buildConflictFlags(view: ScheduleView, editMeta: EditMeta | null): Map<string, ConflictReason> {
  const flags = new Map<string, ConflictReason>()
  if (!editMeta) return flags

  const byEmp = new Map<string, EmpShift[]>()
  const add = (empId: string, day: number, key: ShiftId) => {
    if (!empId) return
    ;(byEmp.get(empId) ?? byEmp.set(empId, []).get(empId)!).push({ day, key })
  }
  for (let day = 0; day < 7; day++) {
    const byShift = view.grid[day] ?? {}
    for (const [shift, byRole] of Object.entries(byShift)) {
      for (const ids of Object.values(byRole)) for (const id of ids) add(id, day, shift as ShiftId)
    }
  }
  for (const t of view.twelve) add(t.employeeId, t.day, t.variant as ShiftId)

  const setWorst = (key: string, reason: ConflictReason) => {
    if (reason === 'rest' || !flags.has(key)) flags.set(key, reason)
  }

  const minRest = editMeta.minRestHours
  for (const [empId, shifts] of byEmp) {
    const meta = editMeta.employees[empId]
    if (!meta) continue
    const days = new Set(shifts.map((s) => s.day))
    if (meta.maxShifts != null && days.size > meta.maxShifts) {
      for (const d of days) setWorst(`${d}:${empId}`, 'overmax')
    }
    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        const gap = gapBetween(shiftInterval(shifts[i].day, shifts[i].key), shiftInterval(shifts[j].day, shifts[j].key))
        if (gap < minRest) {
          setWorst(`${shifts[i].day}:${empId}`, 'rest')
          setWorst(`${shifts[j].day}:${empId}`, 'rest')
        }
      }
    }
  }
  return flags
}
