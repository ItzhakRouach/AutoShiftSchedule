'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { authedWorkplace, GENERIC_ERROR, type EditResult } from './edit-actions-helpers'

/**
 * Copy the most-recent PUBLISHED prior week's assignments into the current
 * period as a manual starting point. Roster (employee) rows only — ad-hoc temp
 * rows are skipped (their null employee_id can't upsert on the (period,
 * employee, day) key). Shift-types/roles are workplace-scoped and stable, so the
 * referenced ids stay valid. Non-destructive-merge via upsert; the manager then
 * tweaks. Not engine-validated (a convenience, like undo) — surfaces as manual.
 */
export async function copyLastWeekSchedule(periodId: string): Promise<EditResult> {
  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const { data: cur } = await supabase
    .from('schedule_periods')
    .select('week_start_date')
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!cur) return { ok: false, error: 'תקופה לא נמצאה.' }

  const { data: prior } = await supabase
    .from('schedule_periods')
    .select('id')
    .eq('workplace_id', workplace.id)
    .eq('status', 'published')
    .lt('week_start_date', cur.week_start_date)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!prior) return { ok: false, error: 'אין שבוע קודם שפורסם להעתקה.' }

  const { data: rows } = await supabase
    .from('assignments')
    .select('employee_id, day_of_week, shift_type_id, role_id, twelve_fills')
    .eq('period_id', prior.id)
    .not('employee_id', 'is', null)
  if (!rows || rows.length === 0) return { ok: false, error: 'אין שיבוצים בשבוע הקודם.' }

  const toInsert = rows.map((r) => ({
    period_id: periodId,
    employee_id: r.employee_id,
    day_of_week: r.day_of_week,
    shift_type_id: r.shift_type_id,
    role_id: r.role_id,
    source: 'manual',
    twelve_fills: r.twelve_fills,
  }))
  const { error } = await supabase
    .from('assignments')
    .upsert(toInsert, { onConflict: 'period_id,employee_id,day_of_week' })
  if (error) return { ok: false, error: GENERIC_ERROR }

  revalidatePath('/schedule')
  return { ok: true }
}
