import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorPeriodRow } from './prior-period'
import { computeAdjacentAbsHours } from './cross-week-abs'

/**
 * Cross-week rest carry-over: given the immediately-preceding period
 * REGARDLESS OF STATUS (resolved upstream via findAdjacentPeriod(-7) — rest
 * protection must hold even when the manager hasn't published that week yet),
 * return per employee the END abs-hours of all their prior-week shifts. The
 * abs reference is "current week day 0 = abs hour 0", so e.g. a
 * prior-Saturday night (23:00–07:00) places at start=-1, end=7 — colliding
 * with Sunday morning at abs 7 (gap 0).
 *
 * Returns {} when `prior` is null or not exactly the preceding week — see
 * computeAdjacentAbsHours for the shared mechanics.
 */
export async function computePriorWeekTail(
  supabase: SupabaseClient,
  workplaceId: string,
  prior: PriorPeriodRow | null,
  currentWeekStart?: string,
): Promise<Record<string, number[]>> {
  return computeAdjacentAbsHours(supabase, workplaceId, prior, currentWeekStart, 'prior')
}
