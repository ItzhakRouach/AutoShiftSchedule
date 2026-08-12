// Shared core for the two cross-week rest carry-over loaders (prior-tail /
// next-head). Both fetch the adjacent period's shift_types + assignments and
// map each assignment to an absolute hour in the CURRENT week's frame
// (current week day 0 = abs hour 0); they differ only in direction (which
// side must be +7 days from the other) and which edge of the shift matters
// (END for the prior week, START for the next week).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorPeriodRow } from './prior-period'

export async function computeAdjacentAbsHours(
  supabase: SupabaseClient,
  workplaceId: string,
  adjacent: PriorPeriodRow | null,
  currentWeekStart: string | undefined,
  direction: 'prior' | 'next',
): Promise<Record<string, number[]>> {
  if (!adjacent) return {}

  // Adjacency check: only consider the period if its days literally abut the
  // current week (gap of exactly 7 days). A gap ≥ 14 days can't violate any
  // plausible rest setting. Callers may omit currentWeekStart (tests).
  if (currentWeekStart !== undefined) {
    const ms = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()
    const delta =
      direction === 'prior'
        ? ms(currentWeekStart) - ms(adjacent.week_start_date)
        : ms(adjacent.week_start_date) - ms(currentWeekStart)
    if (Math.round(delta / 86400000) !== 7) return {}
  }

  const [{ data: shiftTypes }, { data: rows }] = await Promise.all([
    supabase.from('shift_types').select('id, start_hour, hours').eq('workplace_id', workplaceId),
    supabase.from('assignments').select('employee_id, day_of_week, shift_type_id').eq('period_id', adjacent.id),
  ])
  const startById: Record<string, number> = {}
  const hoursById: Record<string, number> = {}
  for (const st of shiftTypes ?? []) {
    startById[st.id as string] = st.start_hour as number
    hoursById[st.id as string] = st.hours as number
  }

  const out: Record<string, number[]> = {}
  for (const r of (rows ?? []) as { employee_id: string; day_of_week: number; shift_type_id: string }[]) {
    const start = startById[r.shift_type_id]
    const hours = hoursById[r.shift_type_id]
    if (start == null || hours == null) continue
    // prior week: shift END abs hour (day −7); next week: shift START abs hour (day +7).
    const abs =
      direction === 'prior'
        ? (r.day_of_week - 7) * 24 + start + hours
        : (r.day_of_week + 7) * 24 + start
    ;(out[r.employee_id] ??= []).push(abs)
  }
  return out
}
