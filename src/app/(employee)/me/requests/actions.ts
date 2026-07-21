'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saveDayRequestSchema } from '@/lib/validation/request'
import { weeklyCapBlocks, weeklyCapMessage, perDayCapBlocks, perDayCapMessage } from '@/lib/requests/cap-check'
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
    const cap = (settingsRow?.max_off_days_per_week as number | null) ?? null
    // When cap is null (no limit configured), skip the count query entirely —
    // there's nothing to compare against, and it saves a round-trip.
    if (cap != null && cap > 0) {
      const { data: otherOffs } = await supabase
        .from('requests')
        .select('day_of_week')
        .eq('period_id', periodId)
        .eq('employee_id', employeeId)
        .eq('is_off', true)
        .neq('day_of_week', dayOfWeek)
      const usedExcludingThisDay = (otherOffs ?? []).length
      if (weeklyCapBlocks(cap, usedExcludingThisDay)) {
        return { error: weeklyCapMessage(cap) }
      }
    }
    // Per-DAY cap: how many OTHER workers are already off this day (RLS-safe
    // RPC). `> 0` guard is defense-in-depth above the DB CHECK (max_off_per_day
    // can no longer be stored as 0). This is a count-then-insert check, not an
    // atomic constraint — under concurrent saves two employees could both pass
    // the check and both land, slightly overfilling the cap. Accepted: these
    // are small workplaces, the cap is a preventive nudge rather than a hard
    // guarantee, and the scheduling engine's coverage-rescue logic absorbs any
    // resulting shortfall. Upgrade path if it ever matters: an atomic RPC with
    // an advisory lock.
    const perDayCap = settingsRow?.max_off_per_day as number | null | undefined
    if (perDayCap != null && perDayCap > 0) {
      const { data: dayOffCount } = await supabase.rpc('off_count_for_day', {
        p_period: periodId,
        p_day: dayOfWeek,
        p_exclude: employeeId,
      })
      if (perDayCapBlocks(perDayCap, (dayOffCount as number | null) ?? 0)) {
        return { error: perDayCapMessage((dayOffCount as number | null) ?? 0, perDayCap) }
      }
    }
  }

  // Empty selection (no shifts, not off) === "no request" — delete the row so
  // the day returns to "טרם נבחר" instead of persisting a junk empty row.
  if (!isOff && preferredShiftIds.length === 0) {
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
