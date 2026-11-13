'use server'

import { getAuthUser } from '@/lib/auth/user'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saveDayRequestSchema } from '@/lib/validation/request'
import { requestCapViolation } from './cap-guards'
import { resolveEmployee, periodInWorkplace, requestWindowLocked, type ActionResult } from './request-helpers'

export async function saveDayRequest(input: unknown): Promise<ActionResult> {
  const parsed = saveDayRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'נתונים לא תקינים' }
  }
  const { periodId, employeeId, dayOfWeek, isOff, preferredShiftIds } = parsed.data

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return { error: 'אין הרשאה' }

  const employee = await resolveEmployee(supabase, user.id)
  if (!employee || employee.id !== employeeId) return { error: 'אין הרשאה' }

  // Guard: period must exist IN THIS WORKPLACE and its window must be open
  // (collecting AND before the deadline — real-time).
  const period = await periodInWorkplace(supabase, periodId, employee.workplace_id)
  if (!period) return { error: 'תקופה לא נמצאה' }
  if (await requestWindowLocked(supabase, period, employee.workplace_id)) {
    return { error: 'הבקשות נעולות — חלון ההגשה נסגר' }
  }

  const isEmptySave = !isOff && preferredShiftIds.length === 0

  // Weekly request-day cap + off-day caps (see cap-guards.ts). A clear is never capped.
  if (!isEmptySave) {
    const violation = await requestCapViolation(supabase, {
      employee, periodId, dayOfWeek, isOff,
    })
    if (violation) return { error: violation }
  }

  // Empty selection (no shifts, not off) === "no request" — delete the row so
  // the day returns to "טרם נבחר" instead of persisting a junk empty row.
  if (isEmptySave) {
    const { error: delErr } = await supabase
      .from('requests')
      .delete()
      .eq('period_id', periodId)
      .eq('employee_id', employeeId)
      .eq('day_of_week', dayOfWeek)
    if (delErr) return { error: 'שגיאה בשמירת הבקשה' }
    revalidatePath('/me/requests')
    return { ok: true }
  }

  const { error } = await supabase.from('requests').upsert(
    {
      period_id: periodId,
      employee_id: employeeId,
      day_of_week: dayOfWeek,
      is_off: isOff,
      preferred_shift_ids: preferredShiftIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'period_id,employee_id,day_of_week' },
  )

  if (error) return { error: 'שגיאה בשמירת הבקשה' }

  revalidatePath('/me/requests')
  return { ok: true }
}

/** Marks (or re-marks) the employee's requests as submitted for a period. */
export async function submitRequests(periodId: string): Promise<ActionResult> {
  if (!periodId) return { error: 'תקופה לא נמצאה' }

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return { error: 'אין הרשאה' }

  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  const period = await periodInWorkplace(supabase, periodId, employee.workplace_id)
  if (!period) return { error: 'תקופה לא נמצאה' }
  if (await requestWindowLocked(supabase, period, employee.workplace_id)) {
    return { error: 'הבקשות נעולות — חלון ההגשה נסגר' }
  }

  const { error } = await supabase.from('request_submissions').upsert(
    { period_id: periodId, employee_id: employee.id, submitted_at: new Date().toISOString() },
    { onConflict: 'period_id,employee_id' },
  )
  if (error) return { error: 'שגיאה בהגשת הבקשות' }

  revalidatePath('/me/requests')
  return { ok: true }
}

/**
 * Wipe ALL of the authenticated employee's per-day requests for a period AND
 * clear their submission marker (so the next visit is a clean slate they can
 * resubmit). Locked once the period is no longer 'collecting'.
 */
export async function clearAllRequests(periodId: string): Promise<ActionResult> {
  if (!periodId) return { error: 'תקופה לא נמצאה' }

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return { error: 'אין הרשאה' }

  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  const period = await periodInWorkplace(supabase, periodId, employee.workplace_id)
  if (!period) return { error: 'תקופה לא נמצאה' }
  if (await requestWindowLocked(supabase, period, employee.workplace_id)) {
    return { error: 'הבקשות נעולות — חלון ההגשה נסגר' }
  }

  const { error: delErr } = await supabase
    .from('requests')
    .delete()
    .eq('period_id', periodId)
    .eq('employee_id', employee.id)
  if (delErr) return { error: 'שגיאה בניקוי הבקשות' }

  // Clear the submission marker too — the employee can resubmit from scratch.
  await supabase
    .from('request_submissions')
    .delete()
    .eq('period_id', periodId)
    .eq('employee_id', employee.id)

  revalidatePath('/me/requests')
  return { ok: true }
}
