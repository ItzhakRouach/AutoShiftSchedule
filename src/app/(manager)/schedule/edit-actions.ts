'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validateManualAssignment } from '@/lib/schedule/validate-edit'
import { resolveShiftKey } from '@/lib/schedule/shift-types-cache'
import { authedWorkplace, slotCapacityError, GENERIC_ERROR, type EditResult } from './edit-actions-helpers'

const TWELVE_H_WARNING =
  'משמרת 12 שעות תופסת שני חלונות 8 שעות ומשפיעה על המנוחה והכיסוי'

/** Upsert (replace same-day) a manual assignment after engine re-validation. */
export async function assignSlot(
  periodId: string,
  dayIndex: number,
  shiftTypeId: string,
  roleId: string,
  employeeId: string,
): Promise<EditResult> {
  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const shiftKey = await resolveShiftKey(supabase, workplace.id, shiftTypeId)
  if (!shiftKey) return { ok: false, error: GENERIC_ERROR }

  const verdict = await validateManualAssignment({
    supabase,
    periodId,
    employeeId,
    dayIndex,
    shiftKey,
    roleId,
  })
  if (!verdict.ok) return { ok: false, error: verdict.reason }

  // Capacity: never exceed the role box's required headcount. Count current
  // occupants of this exact slot EXCLUDING this employee (so re-assigning the
  // same person, or swapping within the slot, is never blocked).
  const capError = await slotCapacityError(
    supabase, workplace.id, periodId, dayIndex, shiftTypeId, roleId, employeeId,
  )
  if (capError) return { ok: false, error: capError }

  const { data, error } = await supabase
    .from('assignments')
    .upsert(
      {
        period_id: periodId,
        employee_id: employeeId,
        day_of_week: dayIndex,
        shift_type_id: shiftTypeId,
        role_id: roleId,
        source: 'manual',
      },
      { onConflict: 'period_id,employee_id,day_of_week' },
    )
    .select('id')
  if (error) return { ok: false, error: GENERIC_ERROR }
  // A silent no-op (0 rows) means RLS or a constraint quietly rejected the write
  // — surface it instead of letting the UI report a phantom success.
  if (!data || data.length === 0) return { ok: false, error: GENERIC_ERROR }

  revalidatePath('/schedule')
  return { ok: true }
}

/** Delete the employee's assignment on a given day. */
export async function unassignSlot(
  periodId: string,
  employeeId: string,
  dayIndex: number,
): Promise<EditResult> {
  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const { data, error } = await supabase
    .from('assignments')
    .delete()
    .eq('period_id', periodId)
    .eq('employee_id', employeeId)
    .eq('day_of_week', dayIndex)
    .select('id')
  if (error) return { ok: false, error: GENERIC_ERROR }
  if (!data || data.length === 0) return { ok: false, error: GENERIC_ERROR }

  revalidatePath('/schedule')
  return { ok: true }
}

/** Manual 12h shift: validate (with 12h hours), persist with source fallback_12h. */
export async function assignTwelveHour(
  periodId: string,
  dayIndex: number,
  variantShiftTypeId: string,
  roleId: string,
  employeeId: string,
): Promise<EditResult> {
  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const shiftKey = await resolveShiftKey(supabase, workplace.id, variantShiftTypeId)
  if (!shiftKey) return { ok: false, error: GENERIC_ERROR }

  const verdict = await validateManualAssignment({
    supabase,
    periodId,
    employeeId,
    dayIndex,
    shiftKey,
    roleId,
  })
  if (!verdict.ok) return { ok: false, error: verdict.reason }

  // unique(period,employee,day) enforces one row/day; the 12h replaces any base.
  const { error } = await supabase
    .from('assignments')
    .upsert(
      {
        period_id: periodId,
        employee_id: employeeId,
        day_of_week: dayIndex,
        shift_type_id: variantShiftTypeId,
        role_id: roleId,
        source: 'fallback_12h',
      },
      { onConflict: 'period_id,employee_id,day_of_week' },
    )
  if (error) return { ok: false, error: GENERIC_ERROR }

  revalidatePath('/schedule')
  return { ok: true, warning: TWELVE_H_WARNING }
}
