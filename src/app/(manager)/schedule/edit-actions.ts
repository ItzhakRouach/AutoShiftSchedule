'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { validateManualAssignment } from '@/lib/schedule/validate-edit'
import { slotAtCapacity } from '@/lib/schedule/validate-edit-core'
import { resolveShiftKey } from '@/lib/schedule/shift-types-cache'

export interface EditResult {
  ok: boolean
  error?: string
  warning?: string
}

const GENERIC_ERROR = 'אירעה שגיאה. נסו שוב.'
const TWELVE_H_WARNING =
  'משמרת 12 שעות תופסת שני חלונות 8 שעות ומשפיעה על המנוחה והכיסוי'

const AT_CAPACITY = 'המשמרת מאוישת במלואה לתפקיד זה'

/** Returns a Hebrew error when the role box is already at its required
 *  headcount, else null. Excludes `employeeId` from the count so swaps and
 *  idempotent re-assignment of the same person are allowed. */
async function slotCapacityError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workplaceId: string,
  periodId: string,
  dayIndex: number,
  shiftTypeId: string,
  roleId: string,
  employeeId: string,
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

  const { data: occupants } = await supabase
    .from('assignments')
    .select('employee_id')
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
    .eq('shift_type_id', shiftTypeId)
    .eq('role_id', roleId)
    .neq('employee_id', employeeId)
  const currentCount = occupants?.length ?? 0

  return slotAtCapacity(currentCount, requiredCount) ? AT_CAPACITY : null
}

async function authedWorkplace() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { redirectLogin: true as const, supabase, workplace: null }
  const workplace = await getActiveWorkplace(supabase)
  return { redirectLogin: false as const, supabase, workplace }
}

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

  const { error } = await supabase
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
  if (error) return { ok: false, error: GENERIC_ERROR }

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
