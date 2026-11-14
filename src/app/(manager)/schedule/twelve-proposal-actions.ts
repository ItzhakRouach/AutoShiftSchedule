'use server'

import { getAuthUser } from '@/lib/auth/user'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { buildEngineInput } from '@/lib/schedule/build-input'
import { buildAssignmentRows } from '@/lib/schedule/persist-rows'
import { fetchAssignmentRows, fetchEmployeesFull } from '@/lib/schedule/cached-reads'
import { buildTwelveProposal, type ProposalRow, type TwelveProposal } from '@/lib/schedule/twelve-proposal'
import { generateSchedule } from '@/lib/scheduling'
import { GENERIC_ERROR, MANUAL_SOURCES } from './run-actions-shared'

export type ProposalResult = { ok: true; proposal: TwelveProposal } | { ok: false; error: string }

/**
 * Works out what "השלמה עם משמרות 12 שעות" would do to this week WITHOUT
 * saving anything: the same engine run (12h enabled, manual rows kept) as
 * runSchedule({ withTwelveHour: true }), compared with the rows saved now.
 * The engine is deterministic for a given week, so approving the proposal
 * (runSchedule) applies exactly this unless the week was edited meanwhile.
 */
export async function previewTwelveHour(periodId: string): Promise<ProposalResult> {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const [built, current, employees] = await Promise.all([
    buildEngineInput(supabase, periodId),
    fetchAssignmentRows(supabase, periodId),
    fetchEmployeesFull(supabase, workplace.id),
  ])
  if (!built || built.period.workplace_id !== workplace.id) return { ok: false, error: GENERIC_ERROR }

  let result
  try {
    result = generateSchedule({ ...built.input, skipTwelve: false })
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }

  // The run keeps every manual / hand-placed 12h row and regenerates the rest.
  const kept = current.filter((r) => (MANUAL_SOURCES as readonly string[]).includes(r.source as string))
  const generated = buildAssignmentRows(result, {
    periodId,
    allKeyToShiftTypeId: built.allKeyToShiftTypeId,
    keyToShiftTypeId: built.keyToShiftTypeId,
    nameToRoleId: built.nameToRoleId,
    preservedRows: kept.filter((r) => r.employee_id).map((r) => ({ employee_id: r.employee_id as string, day_of_week: r.day_of_week })),
    replaceManual: false,
  })

  const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]))
  const proposal = buildTwelveProposal({
    before: current as ProposalRow[],
    after: [...kept, ...generated] as ProposalRow[],
    requirements: built.input.requirements,
    idToKey: invert(built.allKeyToShiftTypeId),
    roleIdToName: invert(built.nameToRoleId),
    names: Object.fromEntries(employees.map((e) => [e.id as string, e.name as string])),
    overrides: result.overriddenOff,
  })
  return { ok: true, proposal }
}
