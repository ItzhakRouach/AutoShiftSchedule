'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { validateManualAssignment } from '@/lib/schedule/validate-edit'
import { planTwelvePair, type DayRoleSlot } from '@/lib/schedule/twelve-pair-core'
import { buildPairSnapshot, type DaySnapshotRow } from '@/lib/schedule/pair-snapshot'
import type { ShiftId } from '@/lib/domain/constants'

export interface PairResult {
  ok: boolean
  error?: string
  warning?: string
}

const GENERIC = 'אירעה שגיאה. נסו שוב.'
const PAIR_WARNING =
  'הוחל צמד 12 שעות: עובד הבוקר מכסה בוקר+צהריים, עובד הלילה מכסה לילה (בתפקידו), ועובד הצהריים של התפקיד הוסר.'

/**
 * Apply a day-level 12h pair: morning emp → m12_day (covers בוקר+צהריים),
 * night emp → m12_night (covers לילה), and remove the chosen role's now-covered
 * צהריים person. Each 12h row PRESERVES the employee's existing base-shift role
 * (so a night-מוקדן promoted to a 12h pair stays מוקדן at night; the wizard's
 * pair role only governs which noon slot is freed). Captures a snapshot of every
 * mutated row in `twelve_pair_snapshots` so cancel can restore.
 */
export async function applyTwelvePair(
  periodId: string,
  dayIndex: number,
  roleId: string,
  morningEmployeeId: string,
  nightEmployeeId: string,
): Promise<PairResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }
  if (morningEmployeeId === nightEmployeeId)
    return { ok: false, error: 'יש לבחור עובד שונה לבוקר וללילה.' }

  const { data: sts } = await supabase.from('shift_types').select('id, key').eq('workplace_id', workplace.id)
  const idByKey: Record<string, string> = {}
  const keyById: Record<string, ShiftId> = {}
  for (const st of sts ?? []) { idByKey[st.key as string] = st.id as string; keyById[st.id as string] = st.key as ShiftId }
  const dayId = idByKey['m12_day'], nightId = idByKey['m12_night'], noonId = idByKey['noon']
  if (!dayId || !nightId || !noonId) return { ok: false, error: GENERIC }

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

  const { data: dayAllRows } = await supabase
    .from('assignments')
    .select('employee_id, shift_type_id, role_id, source')
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
  const rowsAll = (dayAllRows ?? []) as DaySnapshotRow[]

  const roleSlots: DayRoleSlot[] = rowsAll
    .filter((r) => r.role_id === roleId)
    .map((r) => ({ employeeId: r.employee_id, shiftKey: keyById[r.shift_type_id] }))
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

  const { snapshot, morningRoleId, nightRoleId } = buildPairSnapshot({
    dayRows: rowsAll, keyById, morningEmployeeId, nightEmployeeId,
    roleId, noonToRemove, fallbackRoleId: roleId,
  })

  // Persist snapshot — ignoreDuplicates so a re-apply on the same (period, day,
  // role) never clobbers the original pre-pair capture.
  const { error: snapErr } = await supabase
    .from('twelve_pair_snapshots')
    .upsert(
      { period_id: periodId, day_of_week: dayIndex, role_id: roleId, snapshot },
      { onConflict: 'period_id,day_of_week,role_id', ignoreDuplicates: true },
    )
  if (snapErr) return { ok: false, error: GENERIC }

  const base = { period_id: periodId, day_of_week: dayIndex, source: 'fallback_12h' }
  const { error: upErr } = await supabase.from('assignments').upsert([
    { ...base, employee_id: morningEmployeeId, shift_type_id: dayId, role_id: morningRoleId },
    { ...base, employee_id: nightEmployeeId, shift_type_id: nightId, role_id: nightRoleId },
  ], { onConflict: 'period_id,employee_id,day_of_week' })
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
 * Cancel a day's 12h pair for a role: delete the two 12h rows AND restore the
 * pre-pair state captured at apply time (the morning/night employees' base-shift
 * rows and any צהריים row that was removed). Restore uses upsert — if the
 * manager added other rows in between for the same (employee, day), those are
 * overwritten so the original arrangement comes back cleanly.
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

  const { data: snap } = await supabase
    .from('twelve_pair_snapshots')
    .select('snapshot')
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
    .eq('role_id', roleId)
    .maybeSingle()
  const toRestore = ((snap?.snapshot ?? []) as DaySnapshotRow[]).filter(
    (r) => r && r.employee_id && r.shift_type_id && r.role_id,
  )

  // Find the actual 12h rows on this day for this role's pair. The m12_night
  // row may carry a DIFFERENT role_id than the wizard's pair role (it preserves
  // the night-employee's existing night role under Bug 1's fix). To delete both
  // m12 rows reliably, scope by the employee_ids captured in the snapshot —
  // those identify the morning + night employees the pair promoted.
  const snapshotEmployeeIds = [...new Set(toRestore.map((r) => r.employee_id))]
  let delQuery = supabase
    .from('assignments')
    .delete()
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
    .eq('source', 'fallback_12h')
  delQuery = snapshotEmployeeIds.length > 0
    ? delQuery.in('employee_id', snapshotEmployeeIds)
    : delQuery.eq('role_id', roleId) // legacy pairs (no snapshot) — old behavior
  const { error: delErr } = await delQuery
  if (delErr) return { ok: false, error: GENERIC }

  if (toRestore.length > 0) {
    const rows = toRestore.map((r) => ({
      period_id: periodId, day_of_week: dayIndex,
      employee_id: r.employee_id, shift_type_id: r.shift_type_id,
      role_id: r.role_id, source: r.source ?? 'manual',
    }))
    const { error: restoreErr } = await supabase
      .from('assignments')
      .upsert(rows, { onConflict: 'period_id,employee_id,day_of_week' })
    if (restoreErr) return { ok: false, error: GENERIC }
  }

  await supabase
    .from('twelve_pair_snapshots')
    .delete()
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
    .eq('role_id', roleId)

  revalidatePath('/schedule')
  const restoredMsg = toRestore.length > 0
    ? 'צמד 12 השעות בוטל וההשמות הקודמות שוחזרו.'
    : 'צמד 12 השעות בוטל.'
  return { ok: true, warning: restoredMsg }
}
