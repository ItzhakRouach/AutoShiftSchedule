'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { buildAndUploadScheduleImage } from '@/lib/publish/image'
import { unpublishPeriod } from '@/lib/publish/unpublish'
import { statusForDeadline } from '@/lib/publish/period-status'
import { buildEngineInput } from '@/lib/schedule/build-input'
import { generateSchedule } from '@/lib/scheduling'
import type { Coverage, FeasibilityResult, TwelveHourSuggestion } from '@/lib/scheduling/types'

export interface RunResult {
  ok: boolean
  error?: string
  coverage?: Coverage
  feasibility?: FeasibilityResult
  warnings?: number
  twelveHourSuggestions?: TwelveHourSuggestion[]
}

const GENERIC_ERROR = 'אירעה שגיאה בעת יצירת הסידור. נסו שוב.'
const MANUAL_SOURCES = ['manual', 'fallback_12h'] as const

export interface RunOptions {
  /** When false (default), manual/fallback_12h rows are preserved and auto rows
   *  are regenerated around them. When true, ALL rows are wiped first. */
  replaceManual?: boolean
}

export async function runSchedule(
  periodId: string,
  opts: RunOptions = {},
): Promise<RunResult> {
  const { replaceManual = false } = opts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const built = await buildEngineInput(supabase, periodId)
  if (!built || built.period.workplace_id !== workplace.id)
    return { ok: false, error: GENERIC_ERROR }

  // When preserving manual rows: fetch them first so we can skip collisions.
  let preservedRows: { employee_id: string; day_of_week: number }[] = []
  if (!replaceManual) {
    const { data } = await supabase
      .from('assignments')
      .select('employee_id, day_of_week')
      .eq('period_id', periodId)
      .in('source', MANUAL_SOURCES)
    preservedRows = data ?? []
  }

  let result
  try {
    result = generateSchedule(built.input)
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }

  // Build auto rows, skipping any (employee, day) already held by a preserved row.
  const preservedSet = new Set(preservedRows.map((r) => `${r.employee_id}|${r.day_of_week}`))
  const rows: {
    period_id: string
    employee_id: string
    day_of_week: number
    shift_type_id: string
    role_id: string
    source: string
  }[] = []
  const seen = new Set<string>()
  // Auto-assigned 12h coverage: persist ONE canonical row per person/day/variant.
  // The base-shift cells those 12h occupy carry `is12h` and are skipped below.
  for (const t of result.twelveHourAssignments) {
    const dayKey = `${t.employeeId}|${t.day}`
    if (seen.has(dayKey)) continue
    seen.add(dayKey)
    if (!replaceManual && preservedSet.has(dayKey)) continue
    const shiftTypeId = built.allKeyToShiftTypeId[t.variant]
    // role: the variant fills (possibly two roles); persist the first covered.
    const firstShift = Object.keys(t.rolesByShift)[0] as keyof typeof t.rolesByShift
    const roleId = built.nameToRoleId[t.rolesByShift[firstShift] as string]
    if (!shiftTypeId || !roleId) continue
    rows.push({
      period_id: periodId,
      employee_id: t.employeeId,
      day_of_week: t.day,
      shift_type_id: shiftTypeId,
      role_id: roleId,
      source: 'auto',
    })
  }
  for (const [employeeId, assignments] of Object.entries(result.assignmentsByEmployee)) {
    for (const a of assignments) {
      if (a.is12h) continue // covered by the canonical 12h row above
      const shiftTypeId = built.keyToShiftTypeId[a.shift]
      const roleId = built.nameToRoleId[a.roleId]
      if (!shiftTypeId || !roleId) continue
      const dayKey = `${employeeId}|${a.day}`
      if (seen.has(dayKey)) continue
      seen.add(dayKey)
      // Skip slot if the employee already has a preserved manual/12h row that day.
      if (!replaceManual && preservedSet.has(dayKey)) continue
      rows.push({
        period_id: periodId,
        employee_id: employeeId,
        day_of_week: a.day,
        shift_type_id: shiftTypeId,
        role_id: roleId,
        source: 'auto',
      })
    }
  }

  // Delete only auto rows (preserve manual/12h) unless replaceManual=true.
  if (replaceManual) {
    const { error: delError } = await supabase
      .from('assignments')
      .delete()
      .eq('period_id', periodId)
    if (delError) return { ok: false, error: GENERIC_ERROR }
  } else {
    const { error: delError } = await supabase
      .from('assignments')
      .delete()
      .eq('period_id', periodId)
      .eq('source', 'auto')
    if (delError) return { ok: false, error: GENERIC_ERROR }
  }

  if (rows.length > 0) {
    const { error: insError } = await supabase.from('assignments').insert(rows)
    if (insError) return { ok: false, error: GENERIC_ERROR }
  }

  revalidatePath('/schedule')
  return {
    ok: true,
    coverage: result.coverage,
    feasibility: result.feasibility,
    warnings: result.warnings.length,
    twelveHourSuggestions: result.twelveHourSuggestions,
  }
}

export async function publishSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const { data: updated, error } = await supabase
    .from('schedule_periods')
    .update({ status: 'published' })
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .select('id')

  if (error) return { ok: false, error: GENERIC_ERROR }
  if (!updated || updated.length === 0) return { ok: false, error: GENERIC_ERROR }

  // Best-effort: render + upload the schedule image so the WhatsApp share link
  // works. Uses the admin client (storage upload). Never fails the publish.
  try {
    const admin = createAdminClient()
    await buildAndUploadScheduleImage(admin, periodId)
  } catch {
    // swallow — the schedule is published regardless of image upload
  }

  revalidatePath('/schedule')
  return { ok: true }
}

/** Returns true if the period has any manual/12h assignments. */
export async function hasManualAssignments(periodId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('assignments')
    .select('id')
    .eq('period_id', periodId)
    .in('source', MANUAL_SOURCES)
    .limit(1)
  return (data ?? []).length > 0
}

/**
 * Wipe ALL assignments for a period so the manager can generate a fresh
 * schedule from scratch (auto + manual + 12h rows). If the period was
 * published, it's unpublished first (clears the shared image + flips status).
 */
export async function clearSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  // Authorize: the period must belong to the manager's workplace.
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id, status')
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!period) return { ok: false, error: GENERIC_ERROR }

  // If published, unpublish first (status flip + image cleanup).
  if (period.status === 'published') {
    try {
      const admin = createAdminClient()
      await unpublishPeriod(supabase, admin, workplace.id, periodId)
    } catch {
      return { ok: false, error: GENERIC_ERROR }
    }
  }

  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('period_id', periodId)
  if (error) return { ok: false, error: GENERIC_ERROR }

  // Reopen the worker request window if the deadline hasn't passed (a locked
  // period left over from a prior publish/unpublish shouldn't stay closed when
  // the manager wipes the schedule before the deadline).
  const nextStatus = await statusForDeadline(supabase, workplace.id, periodId)
  await supabase
    .from('schedule_periods')
    .update({ status: nextStatus })
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .neq('status', 'published')

  revalidatePath('/schedule')
  revalidatePath('/me/schedule')
  return { ok: true }
}

export async function unpublishSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  try {
    const admin = createAdminClient()
    // Restore requests if still before the deadline; otherwise lock.
    const nextStatus = await statusForDeadline(supabase, workplace.id, periodId)
    await unpublishPeriod(supabase, admin, workplace.id, periodId, nextStatus)
  } catch {
    // unpublishPeriod itself never throws; this guards createAdminClient.
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidatePath('/schedule')
  revalidatePath('/me/schedule')
  return { ok: true }
}
