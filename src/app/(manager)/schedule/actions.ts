'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { sendPublish } from '@/lib/publish/send'
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

  // Best-effort: render the image and send to the WhatsApp group + each worker.
  // Uses the admin client (storage upload + cross-table reads). Failures here
  // never fail the publish itself.
  try {
    const admin = createAdminClient()
    await sendPublish(admin, periodId)
  } catch {
    // swallow — the schedule is published regardless of WhatsApp delivery
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
