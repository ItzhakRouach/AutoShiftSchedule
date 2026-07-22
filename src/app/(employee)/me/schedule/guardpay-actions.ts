'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { findAccountSchema, syncWeekSchema } from '@/lib/validation/guardpay'
import { resolveEmployee, periodInWorkplace } from '../requests/request-helpers'
import { executeGuardPayFunction } from '@/lib/guardpay/appwrite'
import { buildImportKey, buildWeekShifts, type ShiftTypeRow } from '@/lib/guardpay/build-week'
import { collectHolidayDates } from '@/lib/guardpay/holiday-dates'
import { GUARDPAY_ERROR_HE, type FindAccountOk, type ImportWeekOk } from '@/lib/guardpay/types'

export type FindResult = { ok: true; name: string; email: string } | { error: string }
export type LinkResult = { ok: true } | { error: string }
export type SyncResult = { ok: true; created: number } | { error: string }

/** Server-side lookup only — the Appwrite userId never round-trips the client. */
async function lookupAccount(email: string) {
  return executeGuardPayFunction<FindAccountOk>('FIND_ACCOUNT', { email })
}

export async function findGuardPayAccount(input: unknown): Promise<FindResult> {
  const parsed = findAccountSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  const email = parsed.data.email ?? user.email
  if (!email) return { error: 'לא נמצא אימייל בחשבון' }

  const r = await lookupAccount(email)
  if (!r.ok) return { error: GUARDPAY_ERROR_HE[r.code] }
  return { ok: true, name: r.data.name, email: r.data.email }
}

export async function linkGuardPay(input: unknown): Promise<LinkResult> {
  const parsed = findAccountSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  const email = parsed.data.email ?? user.email
  if (!email) return { error: 'לא נמצא אימייל בחשבון' }

  // Re-run the lookup server-side — never trust a client-held account id.
  const r = await lookupAccount(email)
  if (!r.ok) return { error: GUARDPAY_ERROR_HE[r.code] }

  const { error } = await supabase.from('guardpay_links').upsert(
    {
      employee_id: employee.id,
      guardpay_user_id: r.data.userId,
      guardpay_email: r.data.email,
      guardpay_name: r.data.name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'employee_id' },
  )
  if (error) return { error: 'שגיאה בשמירת החיבור' }

  revalidatePath('/me/schedule')
  return { ok: true }
}

export async function unlinkGuardPay(): Promise<LinkResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  await supabase.from('guardpay_syncs').delete().eq('employee_id', employee.id)
  const { error } = await supabase.from('guardpay_links').delete().eq('employee_id', employee.id)
  if (error) return { error: 'שגיאה בניתוק החשבון' }

  revalidatePath('/me/schedule')
  return { ok: true }
}

export async function syncWeekToGuardPay(input: unknown): Promise<SyncResult> {
  const parsed = syncWeekSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const { periodId } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  const period = await periodInWorkplace(supabase, periodId, employee.workplace_id)
  if (!period || period.status !== 'published') return { error: 'השבוע אינו מפורסם' }

  const { data: link } = await supabase
    .from('guardpay_links')
    .select('guardpay_user_id')
    .eq('employee_id', employee.id)
    .maybeSingle()
  if (!link) return { error: 'אין חיבור ל-GuardPay' }

  const [{ data: assignments }, { data: shiftTypes }] = await Promise.all([
    supabase
      .from('assignments')
      .select('day_of_week, shift_type_id')
      .eq('period_id', periodId)
      .eq('employee_id', employee.id),
    supabase
      .from('shift_types')
      .select('id, name, start_hour, hours')
      .eq('workplace_id', employee.workplace_id),
  ])
  const holidaySet = await collectHolidayDates(supabase, employee.workplace_id, period.week_start_date)
  const shiftTypesById = Object.fromEntries(
    ((shiftTypes ?? []) as ShiftTypeRow[]).map((s) => [s.id, s]),
  )

  const shifts = buildWeekShifts({
    weekStart: period.week_start_date,
    assignments: assignments ?? [],
    shiftTypesById,
    holidaySet,
  })

  const r = await executeGuardPayFunction<ImportWeekOk>('IMPORT_WEEK', {
    userId: link.guardpay_user_id,
    importKey: buildImportKey(period.week_start_date),
    shifts,
  })
  if (!r.ok) return { error: GUARDPAY_ERROR_HE[r.code] }

  await supabase.from('guardpay_syncs').upsert(
    {
      employee_id: employee.id,
      period_id: periodId,
      synced_at: new Date().toISOString(),
      shift_count: r.data.created,
    },
    { onConflict: 'employee_id,period_id' },
  )

  revalidatePath('/me/schedule')
  return { ok: true, created: r.data.created }
}
