import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorPeriodRow } from './prior-period'

/**
 * Cross-week rest carry-over: given the immediately-preceding published period
 * (resolved upstream via findPriorPublishedPeriod), return per employee the
 * END abs-hours of all their prior-week shifts. The abs reference is
 * "current week day 0 = abs hour 0", so e.g. a prior-Saturday night
 * (23:00–07:00) places at start=-1, end=7 — colliding with Sunday morning at
 * abs 7 (gap 0).
 *
 * Returns {} when `prior` is null or the prior period is not the immediately
 * preceding week (gap of exactly 7 days). A gap ≥ 14 days can't violate any
 * plausible rest setting, so we skip the load to save round-trips.
 *
 * Performance: shift_types + assignments are fetched in parallel.
 */
export async function computePriorWeekTail(
  supabase: SupabaseClient,
  workplaceId: string,
  prior: PriorPeriodRow | null,
  // `currentWeekStart` retained for the adjacency check; null shortcut bails
  // before any further work when there's no prior published period at all.
  currentWeekStart?: string,
): Promise<Record<string, number[]>> {
  if (!prior) return {}

  // Adjacency check: only consider the prior period if its days literally abut
  // the current week (i.e. prior_start + 7 days = current_start). The caller
  // may omit currentWeekStart when adjacency is irrelevant (tests).
  if (currentWeekStart !== undefined) {
    const ms = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()
    const dayDelta = Math.round((ms(currentWeekStart) - ms(prior.week_start_date)) / 86400000)
    if (dayDelta !== 7) return {}
  }

  const [{ data: shiftTypes }, { data: rows }] = await Promise.all([
    supabase.from('shift_types').select('id, start_hour, hours').eq('workplace_id', workplaceId),
    supabase.from('assignments').select('employee_id, day_of_week, shift_type_id').eq('period_id', prior.id),
  ])
  const startById: Record<string, number> = {}
  const hoursById: Record<string, number> = {}
  for (const st of shiftTypes ?? []) {
    startById[st.id as string] = st.start_hour as number
    hoursById[st.id as string] = st.hours as number
  }

  const tail: Record<string, number[]> = {}
  for (const r of (rows ?? []) as { employee_id: string; day_of_week: number; shift_type_id: string }[]) {
    const start = startById[r.shift_type_id]
    const hours = hoursById[r.shift_type_id]
    if (start == null || hours == null) continue
    const priorDayOffset = r.day_of_week - 7
    const endAbs = priorDayOffset * 24 + start + hours
    ;(tail[r.employee_id] ??= []).push(endAbs)
  }
  return tail
}
