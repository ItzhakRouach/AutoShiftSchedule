'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
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

export async function runSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const built = await buildEngineInput(supabase, periodId)
  // Defensive: RLS ensures the period belongs to the manager; verify ownership.
  if (!built || built.period.workplace_id !== workplace.id) {
    return { ok: false, error: GENERIC_ERROR }
  }

  let result
  try {
    result = generateSchedule(built.input)
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }

  // Build assignment rows from the engine's per-employee assignments.
  const rows: {
    period_id: string
    employee_id: string
    day_of_week: number
    shift_type_id: string
    role_id: string
    source: string
  }[] = []

  // DB enforces UNIQUE(period_id, employee_id, day_of_week): at most one shift per
  // employee per day. Dedupe defensively (keep first) to never violate it.
  const seen = new Set<string>()
  for (const [employeeId, assignments] of Object.entries(result.assignmentsByEmployee)) {
    for (const a of assignments) {
      const shiftTypeId = built.keyToShiftTypeId[a.shift]
      const roleId = built.nameToRoleId[a.roleId]
      if (!shiftTypeId || !roleId) continue
      const dayKey = `${employeeId}|${a.day}`
      if (seen.has(dayKey)) continue
      seen.add(dayKey)
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

  const { error: delError } = await supabase.from('assignments').delete().eq('period_id', periodId)
  if (delError) return { ok: false, error: GENERIC_ERROR }

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

  revalidatePath('/schedule')
  return { ok: true }
}
