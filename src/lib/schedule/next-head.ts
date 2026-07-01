import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorPeriodRow } from './prior-period'

/**
 * Cross-week rest carry-over, symmetric to computePriorWeekTail but looking
 * FORWARD: given the immediately-following period REGARDLESS OF STATUS
 * (resolved upstream via findAdjacentPeriod(+7) — an unpublished next-week
 * draft's assignments are real commitments an employee will actually work),
 * return per employee the START abs-hours of all their next-week shifts. The
 * abs reference is "current week day 0 = abs hour 0", so e.g. a next-week
 * Sunday morning (07:00) places at day offset 7 → abs hour 175 — colliding
 * with a current-week Saturday night that ends at abs 175 (gap 0).
 *
 * Returns {} when `next` is null or the next period is not the immediately
 * following week (gap of exactly 7 days). A gap ≥ 14 days can't violate any
 * plausible rest setting, so we skip the load to save round-trips.
 *
 * Performance: shift_types + assignments are fetched in parallel.
 */
export async function computeNextWeekHead(
  supabase: SupabaseClient,
  workplaceId: string,
  next: PriorPeriodRow | null,
  // `currentWeekStart` retained for the adjacency check; null shortcut bails
  // before any further work when there's no next period at all.
  currentWeekStart?: string,
): Promise<Record<string, number[]>> {
  if (!next) return {}

  // Adjacency check: only consider the next period if its days literally abut
  // the current week (i.e. current_start + 7 days = next_start). The caller
  // may omit currentWeekStart when adjacency is irrelevant (tests).
  if (currentWeekStart !== undefined) {
    const ms = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()
    const dayDelta = Math.round((ms(next.week_start_date) - ms(currentWeekStart)) / 86400000)
    if (dayDelta !== 7) return {}
  }

  const [{ data: shiftTypes }, { data: rows }] = await Promise.all([
    supabase.from('shift_types').select('id, start_hour, hours').eq('workplace_id', workplaceId),
    supabase.from('assignments').select('employee_id, day_of_week, shift_type_id').eq('period_id', next.id),
  ])
  const startById: Record<string, number> = {}
  for (const st of shiftTypes ?? []) {
    startById[st.id as string] = st.start_hour as number
  }

  const head: Record<string, number[]> = {}
  for (const r of (rows ?? []) as { employee_id: string; day_of_week: number; shift_type_id: string }[]) {
    const start = startById[r.shift_type_id]
    if (start == null) continue
    const nextDayOffset = r.day_of_week + 7
    const startAbs = nextDayOffset * 24 + start
    ;(head[r.employee_id] ??= []).push(startAbs)
  }
  return head
}
