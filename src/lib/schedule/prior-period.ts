import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PriorPeriodRow {
  id: string
  week_start_date: string
}

/**
 * Locate the most-recent PUBLISHED schedule_period for a workplace whose
 * week_start_date is strictly BEFORE `currentWeekStart`. Used by BOTH cross-week
 * deficit (fairness carry-over) and cross-week rest tail computations — having
 * one shared lookup avoids two identical queries when both run in the same
 * buildEngineInput call.
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
