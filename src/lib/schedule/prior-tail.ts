import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cross-week rest carry-over: locate the IMMEDIATELY-preceding published period
 * (week starts exactly 7 days before currentWeekStart) and return, per
 * employee, the END abs-hours of all their prior-week shifts. The abs reference
 * is "current week day 0 = abs hour 0", so e.g. a prior-Saturday night
 * (23:00–07:00) places at start=-1, end=7 — colliding with Sunday morning at
 * abs 7 (gap 0). Returns {} when there is no adjacent published prior period.
 * Loads ALL shifts (not just Saturday) so the gap math captures any case that
 * could reach into the new week under the configured minRestHours.
 */
export async function computePriorWeekTail(
  supabase: SupabaseClient,
  workplaceId: string,
  currentWeekStart: string,
): Promise<Record<string, number[]>> {
  const { data: prior } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date')
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .lt('week_start_date', currentWeekStart)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!prior) return {}

  // Adjacency check: only consider the prior period if its days literally abut
  // the current week (i.e. prior_start + 7 days = current_start). A gap >= 14
  // days can't violate any plausible rest setting, so skip the load.
  const ms = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()
  const dayDelta = Math.round((ms(currentWeekStart) - ms(prior.week_start_date as string)) / 86400000)
  if (dayDelta !== 7) return {}

  const { data: shiftTypes } = await supabase
    .from('shift_types')
    .select('id, start_hour, hours')
    .eq('workplace_id', workplaceId)
  const startById: Record<string, number> = {}
  const hoursById: Record<string, number> = {}
  for (const st of shiftTypes ?? []) {
    startById[st.id as string] = st.start_hour as number
    hoursById[st.id as string] = st.hours as number
  }

  const { data: rows } = await supabase
    .from('assignments')
    .select('employee_id, day_of_week, shift_type_id')
    .eq('period_id', prior.id)

  const tail: Record<string, number[]> = {}
  for (const r of (rows ?? []) as { employee_id: string; day_of_week: number; shift_type_id: string }[]) {
    const start = startById[r.shift_type_id]
    const hours = hoursById[r.shift_type_id]
    if (start == null || hours == null) continue
    // Prior day 0..6 maps to current day (-7..-1). End abs = (priorDay - 7) * 24 + start + hours.
    const priorDayOffset = r.day_of_week - 7
    const endAbs = priorDayOffset * 24 + start + hours
    ;(tail[r.employee_id] ??= []).push(endAbs)
  }
  return tail
}
