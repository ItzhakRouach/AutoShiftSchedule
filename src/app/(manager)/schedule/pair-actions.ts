'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { validateManualAssignment } from '@/lib/schedule/validate-edit'
import { planTwelvePair, type DayRoleSlot } from '@/lib/schedule/twelve-pair-core'
import type { ShiftId } from '@/lib/domain/constants'

export interface PairResult {
  ok: boolean
  error?: string
  warning?: string
}

const GENERIC = 'אירעה שגיאה. נסו שוב.'
const PAIR_WARNING =
  'הוחל צמד 12 שעות: עובד הבוקר מכסה בוקר+צהריים, עובד הלילה מכסה לילה, ועובד הצהריים של התפקיד הוסר.'

/**
 * Apply a day-level 12h pair for a role: morning emp → m12_day (בוקר+צהריים),
 * night emp → m12_night (לילה), and remove the role's now-covered צהריים person.
 * Validates both promotions with the engine-backed core; rejects atomically with
 * a Hebrew reason if either fails (nothing is written).
 */
export async function applyTwelvePair(
  periodId: string,
  dayIndex: number,
  roleId: string,
  morningEmployeeId: string,
  nightEmployeeId: string,
): Promise<PairResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }
  if (morningEmployeeId === nightEmployeeId)
    return { ok: false, error: 'יש לבחור עובד שונה לבוקר וללילה.' }

  // Resolve shift-type ids for the two 12h variants.
  const { data: sts } = await supabase
    .from('shift_types')
    .select('id, key')
    .eq('workplace_id', workplace.id)
  const idByKey: Record<string, string> = {}
  for (const st of sts ?? []) idByKey[st.key as string] = st.id as string
  const dayId = idByKey['m12_day']
  const nightId = idByKey['m12_night']
  const noonId = idByKey['noon']
  if (!dayId || !nightId || !noonId) return { ok: false, error: GENERIC }

  // Validate both promotions via the engine core (role, covered-window sacred/
  // availability, rest using 12h duration, max, one-per-day).
  const dayVerdict = await validateManualAssignment({
    supabase, periodId, employeeId: morningEmployeeId, dayIndex,
    shiftKey: 'm12_day' as ShiftId, roleId,
  })
  if (!dayVerdict.ok) return { ok: false, error: dayVerdict.reason }
  const nightVerdict = await validateManualAssignment({
    supabase, periodId, employeeId: nightEmployeeId, dayIndex,
    shiftKey: 'm12_night' as ShiftId, roleId,
  })
  if (!nightVerdict.ok) return { ok: false, error: nightVerdict.reason }

  // Current assignments of this role on the day → plan the noon removal.
  const { data: dayRows } = await supabase
    .from('assignments')
    .select('employee_id, shift_type_id')
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
    .eq('role_id', roleId)
  const keyById: Record<string, ShiftId> = {}
  for (const st of sts ?? []) keyById[st.id as string] = st.key as ShiftId
  const roleSlots: DayRoleSlot[] = (dayRows ?? [])
    .map((r) => ({ employeeId: r.employee_id as string, shiftKey: keyById[r.shift_type_id as string] }))
    .filter((s) => Boolean(s.shiftKey))

  const { data: reqRow } = await supabase
    .from('shift_requirements')
    .select('count')
    .eq('workplace_id', workplace.id)
    .eq('day_of_week', dayIndex)
    .eq('shift_type_id', noonId)
    .eq('role_id', roleId)
    .maybeSingle()
  const noonRequired = (reqRow?.count as number) ?? 1

  const { noonToRemove } = planTwelvePair({
    roleSlots, morningEmployeeId, nightEmployeeId, noonRequired,
  })

  // Apply: upsert both 12h rows (replaces same-day rows), then remove the noon person.
  const rows = [
    { employee_id: morningEmployeeId, shift_type_id: dayId },
    { employee_id: nightEmployeeId, shift_type_id: nightId },
  ].map((r) => ({
    period_id: periodId, day_of_week: dayIndex, role_id: roleId,
    source: 'fallback_12h', ...r,
  }))
  const { error: upErr } = await supabase
    .from('assignments')
    .upsert(rows, { onConflict: 'period_id,employee_id,day_of_week' })
  if (upErr) return { ok: false, error: GENERIC }

  if (noonToRemove.length > 0) {
    const { error: delErr } = await supabase
      .from('assignments')
      .delete()
      .eq('period_id', periodId)
      .eq('day_of_week', dayIndex)
      .eq('role_id', roleId)
      .eq('shift_type_id', noonId)
      .in('employee_id', noonToRemove)
    if (delErr) return { ok: false, error: GENERIC }
  }

  revalidatePath('/schedule')
  return { ok: true, warning: PAIR_WARNING }
}

/**
 * Cancel a day's 12h pair for a role: delete the two 12h rows (m12_day / m12_night)
 * for that day + role. The freed base cells become empty for the manager to refill.
 */
export async function cancelTwelvePair(
  periodId: string,
  dayIndex: number,
  roleId: string,
): Promise<PairResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
    .eq('role_id', roleId)
    .eq('source', 'fallback_12h')
  if (error) return { ok: false, error: GENERIC }

  revalidatePath('/schedule')
  return { ok: true, warning: 'צמד 12 השעות בוטל. ניתן לשבץ מחדש את המשמרות הרגילות.' }
}
