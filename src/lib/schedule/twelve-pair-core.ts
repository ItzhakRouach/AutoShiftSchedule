// PURE planning for the day-level "12h pair" wizard. NO Supabase/IO. Decides
// what an applied pair does: morning employee → m12_day (covers בוקר+צהריים),
// night employee → m12_night (covers לילה), and the role's צהריים person whose
// requirement is now covered by m12_day is removed — without leaving any noon
// slot for that role under-covered.
import type { ShiftId } from '@/lib/domain/constants'
import type { TwelveFillEntry } from './twelve-fills'

/** A base-shift assignment on the target day, scoped to one role. */
export interface DayRoleSlot {
  employeeId: string
  shiftKey: ShiftId
}

export interface PlanArgs {
  /** All current assignments of the chosen role on the target day. */
  roleSlots: DayRoleSlot[]
  morningEmployeeId: string
  nightEmployeeId: string
  /** Required count of צהריים (noon) for this role on the day (default 1). */
  noonRequired: number
}

export interface PairPlan {
  /** Noon employee ids of the role to delete (their slot is now covered). */
  noonToRemove: string[]
}

/**
 * Decide which צהריים (noon) employees of the role to remove. The m12_day person
 * covers ONE unit of the role's noon requirement, so we may remove at most one
 * noon person — and only if doing so does not drop noon coverage below required.
 * Never removes the morning or night employee we're about to promote.
 */
export function planTwelvePair(args: PlanArgs): PairPlan {
  const { roleSlots, morningEmployeeId, nightEmployeeId, noonRequired } = args
  const noonEmployees = roleSlots
    .filter((s) => s.shiftKey === 'noon')
    .map((s) => s.employeeId)
    .filter((id) => id !== morningEmployeeId && id !== nightEmployeeId)

  // m12_day fills exactly one noon unit. Remaining noon coverage after promoting
  // = (current noon count) - (removed). We must keep covered+remaining >= required.
  // Covered by m12_day = 1. So removable = current + 1 - required, capped at 1.
  const removable = Math.max(0, Math.min(1, noonEmployees.length + 1 - noonRequired))
  return { noonToRemove: noonEmployees.slice(0, removable) }
}

export interface PairTwelveFills {
  morning: TwelveFillEntry[]
  night: TwelveFillEntry[]
}

/**
 * The twelve_fills plan for the two rows an applied pair writes: the morning
 * row covers morning (under the morning person's OWN role) + noon (under the
 * wizard's chosen pair role — the noon slot this pair frees up); the night
 * row covers night under the night person's OWN (preserved) role.
 */
export function pairTwelveFills(
  morningRoleId: string,
  nightRoleId: string,
  pairRoleId: string,
): PairTwelveFills {
  return {
    morning: [
      { shift: 'morning', role_id: morningRoleId },
      { shift: 'noon', role_id: pairRoleId },
    ],
    night: [{ shift: 'night', role_id: nightRoleId }],
  }
}
