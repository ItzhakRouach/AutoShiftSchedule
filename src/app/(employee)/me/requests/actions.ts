'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saveDayRequestSchema } from '@/lib/validation/request'
import { resolveEmployee, periodInWorkplace, requestWindowLocked, type ActionResult } from './request-helpers'

export async function saveDayRequest(input: unknown): Promise<ActionResult> {
  const parsed = saveDayRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'נתונים לא תקינים' }
  }
  const { periodId, employeeId, dayOfWeek, isOff, preferredShiftIds } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  // Enforce the workplace cap on "יום חופש / לא זמין" requests. Only when the
  // employee is FLIPPING a day TO off (isOff=true). Counts existing off-days
  // for OTHER days in the same period; the day being saved is excluded since
  // the upsert will replace it.
  if (isOff) {
    const { data: settingsRow } = await supabase
      .from('workplace_settings')
      .select('max_off_days_per_week, max_off_per_day')
      .eq('workplace_id', employee.workplace_id)
      .maybeSingle()
    const cap = (settingsRow?.max_off_days_per_week as number | null) ?? 2
    const { data: otherOffs } = await supabase
      .from('requests')
      .select('day_of_week')
      .eq('period_id', periodId)
      .eq('employee_id', employeeId)
      .eq('is_off', true)
      .neq('day_of_week', dayOfWeek)
    const usedExcludingThisDay = (otherOffs ?? []).length
    if (usedExcludingThisDay + 1 > cap) {
      return { error: `הגעת למקסימום ימי חופש לשבוע (${cap})` }
    }
    // Per-DAY cap: how many OTHER workers are already off this day (RLS-safe RPC).
    const perDayCap = settingsRow?.max_off_per_day as number | null | undefined
    if (perDayCap != null) {
      const { data: dayOffCount } = await supabase.rpc('off_count_for_day', {
        p_period: periodId,
        p_day: dayOfWeek,
        p_exclude: employeeId,
      })
      if (((dayOffCount as number | null) ?? 0) >= perDayCap) {
        return { error: `כבר ${perDayCap} עובדים בחופש ביום זה — לא ניתן להוסיף` }
      }
    }
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
  const { data: { user } } = await supabase.auth.getUser()
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
  const { data: { user } } = await supabase.auth.getUser()
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
