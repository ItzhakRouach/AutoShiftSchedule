'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { buildEngineInput } from '@/lib/schedule/build-input'
import { buildAssignmentRows } from '@/lib/schedule/persist-rows'
import { generateSchedule } from '@/lib/scheduling'
import { GENERIC_ERROR, MANUAL_SOURCES, type RunResult, type RunOptions } from './run-actions-shared'

const isDev = process.env.NODE_ENV === 'development'

export async function runSchedule(
  periodId: string,
  opts: RunOptions = {},
): Promise<RunResult> {
  const actionStart = isDev ? performance.now() : 0
  const { replaceManual = false, withTwelveHour = false } = opts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const buildStart = isDev ? performance.now() : 0
  const built = await buildEngineInput(supabase, periodId)
  const buildMs = isDev ? performance.now() - buildStart : 0
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
    const engineStart = isDev ? performance.now() : 0
    result = generateSchedule({ ...built.input, collectTimings: isDev, skipTwelve: !withTwelveHour })
    if (isDev) {
      console.debug('[engine timings]', result.timings, 'engine ms', performance.now() - engineStart)
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }

  // Build auto rows, skipping any (employee, day) already held by a preserved row.
  const rows = buildAssignmentRows(result, {
    periodId,
    allKeyToShiftTypeId: built.allKeyToShiftTypeId,
    keyToShiftTypeId: built.keyToShiftTypeId,
    nameToRoleId: built.nameToRoleId,
    preservedRows,
    replaceManual,
  })

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
  if (isDev) {
    console.debug('[engine timings] buildEngineInput ms', buildMs, 'total action ms', performance.now() - actionStart)
  }
  return {
    ok: true,
    coverage: result.coverage,
    feasibility: result.feasibility,
    warnings: result.warnings.length,
    twelveHourSuggestions: result.twelveHourSuggestions,
    overriddenOff: result.overriddenOff,
    uncovered: result.warnings,
  }
}
