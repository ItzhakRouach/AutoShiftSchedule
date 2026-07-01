import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PriorPeriodRow {
  id: string
  week_start_date: string
}

/**
 * Locate the most-recent PUBLISHED schedule_period for a workplace whose
 * week_start_date is strictly BEFORE `currentWeekStart`. Used by cross-week
 * deficit/extras (fairness carry-over), which must count only PUBLISHED
 * reality — an unpublished draft's shift counts aren't a commitment yet.
 *
 * Returns null when there is no prior published period.
 */
export async function findPriorPublishedPeriod(
  supabase: SupabaseClient,
  workplaceId: string,
  currentWeekStart: string,
): Promise<PriorPeriodRow | null> {
  const { data } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date')
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .lt('week_start_date', currentWeekStart)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as PriorPeriodRow | null) ?? null
}

/**
 * Locate the schedule_period exactly `offsetDays` away from `weekStart`
 * (-7 = the immediately preceding week, +7 = the immediately following week),
 * REGARDLESS of status. Cross-week REST protection (unlike fairness) must hold
 * against whatever assignments already exist in the adjacent week even if the
 * manager hasn't published it yet — an unpublished draft's shifts are real
 * commitments an employee will actually work.
 *
 * Returns null when no period has that exact week_start_date.
 */
export async function findAdjacentPeriod(
  supabase: SupabaseClient,
  workplaceId: string,
  weekStart: string,
  offsetDays: -7 | 7,
): Promise<PriorPeriodRow | null> {
  const base = new Date(`${weekStart}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + offsetDays)
  const targetISO = base.toISOString().slice(0, 10)

  const { data } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date')
    .eq('workplace_id', workplaceId)
    .eq('week_start_date', targetISO)
    .maybeSingle()
  return (data as PriorPeriodRow | null) ?? null
}
