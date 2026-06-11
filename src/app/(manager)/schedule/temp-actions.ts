'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { authedWorkplace, slotCapacityError, GENERIC_ERROR, type EditResult } from './edit-actions-helpers'

const tempNameSchema = z.string().trim().min(1).max(40)
const NAME_INVALID = 'יש להזין שם זמני (עד 40 תווים).'

/** Place a free-text "temp" worker (not in the roster) into a slot. Stored with
 *  employee_id NULL + temp_name; one row per name, no one-shift-per-day rule. */
export async function assignTempName(
  periodId: string,
  dayIndex: number,
  shiftTypeId: string,
  roleId: string,
  name: string,
): Promise<EditResult> {
  const parsed = tempNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: NAME_INVALID }

  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  // Count every current occupant (no employee to exclude) against the slot's cap.
  const capError = await slotCapacityError(
    supabase, workplace.id, periodId, dayIndex, shiftTypeId, roleId, null,
  )
  if (capError) return { ok: false, error: capError }

  const { data, error } = await supabase
    .from('assignments')
    .insert({
      period_id: periodId,
      employee_id: null,
      temp_name: parsed.data,
      day_of_week: dayIndex,
      shift_type_id: shiftTypeId,
      role_id: roleId,
      source: 'manual',
    })
    .select('id')
  if (error) return { ok: false, error: GENERIC_ERROR }
  if (!data || data.length === 0) return { ok: false, error: GENERIC_ERROR }

  revalidatePath('/schedule')
  return { ok: true }
}

/** Delete a single assignment by id (used for temp rows, which have no
 *  employee_id for unassignSlot to target). RLS scopes to the owner's periods. */
export async function removeAssignmentById(
  periodId: string,
  assignmentId: string,
): Promise<EditResult> {
  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const { data, error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('period_id', periodId)
    .select('id')
  if (error) return { ok: false, error: GENERIC_ERROR }
  if (!data || data.length === 0) return { ok: false, error: GENERIC_ERROR }

  revalidatePath('/schedule')
  return { ok: true }
}
