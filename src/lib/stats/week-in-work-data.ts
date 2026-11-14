import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveEditWeek } from '@/lib/schedule/edit-week'
import { fetchAssignmentRows, fetchEmployeesFull, fetchRequirements, fetchShiftTypes } from '@/lib/schedule/cached-reads'
import { summarizeWeekInWork, type WeekInWork } from './week-in-work'

/**
 * Loads the week the manager is currently building (the same week /schedule
 * opens on) and summarizes it for the dashboard. One round of parallel reads
 * after the week is resolved; null when the workplace has no editable week.
 */
export async function getWeekInWork(
  supabase: SupabaseClient,
  workplaceId: string,
  now: Date = new Date(),
): Promise<WeekInWork | null> {
  const week = await resolveEditWeek(supabase, workplaceId)
  if (!week) return null

  const [assignments, shiftTypes, employees, requirements, { data: slotMarks }, { data: requests }, { data: settings }, { data: workplace }] =
    await Promise.all([
      fetchAssignmentRows(supabase, week.periodId),
      fetchShiftTypes(supabase, workplaceId),
      fetchEmployeesFull(supabase, workplaceId),
      fetchRequirements(supabase, workplaceId),
      supabase.from('slot_marks').select('day_of_week, shift_type_id, role_id, label').eq('period_id', week.periodId),
      supabase.from('requests').select('employee_id').eq('period_id', week.periodId),
      supabase.from('workplace_settings').select('request_deadline_dow, request_deadline_time').eq('workplace_id', workplaceId).maybeSingle(),
      supabase.from('workplaces').select('timezone').eq('id', workplaceId).maybeSingle(),
    ])

  const dow = settings?.request_deadline_dow as number | null | undefined
  const time = settings?.request_deadline_time as string | null | undefined
  return summarizeWeekInWork({
    weekStart: week.weekStart,
    shiftTypes,
    requirements,
    assignments,
    slotMarks: slotMarks ?? [],
    requests: requests ?? [],
    employees,
    deadline: dow != null && time
      ? { dow, time, zone: (workplace?.timezone as string | null | undefined) ?? 'Asia/Jerusalem' }
      : null,
    nowMs: now.getTime(),
  })
}
