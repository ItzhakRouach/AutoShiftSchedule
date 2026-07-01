import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { slotAtCapacity } from '@/lib/schedule/validate-edit-core'
import type { UndoSnapshot } from '@/lib/schedule/undo-core'

export interface EditResult {
  ok: boolean
  error?: string
  warning?: string
  /** Pre-mutation snapshot for single-step undo, when the action is reversible. */
  undo?: UndoSnapshot
}

export const GENERIC_ERROR = 'אירעה שגיאה. נסו שוב.'
export const AT_CAPACITY = 'המשמרת מאוישת במלואה לתפקיד זה'

/** Resolve the authed user's active workplace once, shared by the slot actions. */
export async function authedWorkplace() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { redirectLogin: true as const, supabase, workplace: null }
  const workplace = await getActiveWorkplace(supabase)
  return { redirectLogin: false as const, supabase, workplace }
}

/** Returns a Hebrew error when the role box is already at its required
 *  headcount, else null. When `excludeEmployeeId` is given that employee is left
 *  out of the count so swaps / idempotent re-assignment of the same person are
 *  allowed; pass null (temp inserts) to count every current occupant.
 *  A slot with no requirement row (count 0) is unconfigured → never at capacity,
 *  so the manager can fill empty cells (see slotAtCapacity). */
export async function slotCapacityError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workplaceId: string,
  periodId: string,
  dayIndex: number,
  shiftTypeId: string,
  roleId: string,
  excludeEmployeeId: string | null,
): Promise<string | null> {
  const { data: req } = await supabase
    .from('shift_requirements')
    .select('count')
    .eq('workplace_id', workplaceId)
    .eq('day_of_week', dayIndex)
    .eq('shift_type_id', shiftTypeId)
    .eq('role_id', roleId)
    .maybeSingle()
  const requiredCount = (req?.count as number | undefined) ?? 0

  let q = supabase
    .from('assignments')
    .select('employee_id')
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
    .eq('shift_type_id', shiftTypeId)
    .eq('role_id', roleId)
  if (excludeEmployeeId) q = q.neq('employee_id', excludeEmployeeId)
  const { data: occupants } = await q
  const currentCount = occupants?.length ?? 0

  return slotAtCapacity(currentCount, requiredCount) ? AT_CAPACITY : null
}
