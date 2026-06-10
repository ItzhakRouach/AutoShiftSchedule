'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { workplaceOwnershipError } from '@/lib/employees/validate-ownership'

type Result = { ok: true } | { error: string }

/**
 * Manager sets/updates a worker's shift request for a day (preferred shifts or
 * an off-day), on the worker's behalf. Manager-only and workplace-scoped: the
 * period, employee, and shift types must all belong to the manager's active
 * workplace. Writes via the admin client because the requests RLS only lets the
 * OWNING employee write their own rows.
 */
export async function managerSaveDayRequest(input: {
  periodId: string
  employeeId: string
  dayOfWeek: number
  isOff: boolean
  preferredShiftIds: string[]
}): Promise<Result> {
  const { periodId, employeeId, dayOfWeek, isOff, preferredShiftIds } = input
  if (!periodId || !employeeId || dayOfWeek < 0 || dayOfWeek > 6) return { error: 'נתונים לא תקינים' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  // Period + employee + shift types must belong to the manager's workplace.
  const [{ data: period }, { data: emp }] = await Promise.all([
    supabase.from('schedule_periods').select('id').eq('id', periodId).eq('workplace_id', workplace.id).maybeSingle(),
    supabase.from('employees').select('id').eq('id', employeeId).eq('workplace_id', workplace.id).maybeSingle(),
  ])
  if (!period) return { error: 'תקופה לא נמצאה' }
  if (!emp) return { error: 'עובד לא נמצא' }

  // Shifts + off are combinable ("morning OR off"), so keep both.
  const shiftIds = preferredShiftIds
  const ownErr = await workplaceOwnershipError(supabase, workplace.id, [], shiftIds)
  if (ownErr) return { error: ownErr }

  const admin = createAdminClient()
  const { error } = await admin.from('requests').upsert(
    {
      period_id: periodId,
      employee_id: employeeId,
      day_of_week: dayOfWeek,
      is_off: isOff,
      preferred_shift_ids: shiftIds,
    },
    { onConflict: 'period_id,employee_id,day_of_week' },
  )
  if (error) return { error: 'שגיאה בשמירת הבקשה' }

  revalidatePath('/schedule')
  return { ok: true }
}

/** Manager wipes ALL workers' requests for a period (a clean slate to re-enter).
 *  Manager-only + workplace-scoped; the period FK guarantees the rows belong to
 *  this workplace. Admin client (requests RLS is employee-owned). */
export async function managerClearAllRequests(periodId: string): Promise<Result> {
  if (!periodId) return { error: 'תקופה לא נמצאה' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id')
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!period) return { error: 'תקופה לא נמצאה' }

  const admin = createAdminClient()
  const { error } = await admin.from('requests').delete().eq('period_id', periodId)
  if (error) return { error: 'שגיאה בניקוי הבקשות' }

  revalidatePath('/schedule')
  return { ok: true }
}
