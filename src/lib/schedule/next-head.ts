import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorPeriodRow } from './prior-period'
import { computeAdjacentAbsHours } from './cross-week-abs'

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
 * Returns {} when `next` is null or not exactly the following week — see
 * computeAdjacentAbsHours for the shared mechanics.
 */
export async function computeNextWeekHead(
  supabase: SupabaseClient,
  workplaceId: string,
  next: PriorPeriodRow | null,
  currentWeekStart?: string,
): Promise<Record<string, number[]>> {
  return computeAdjacentAbsHours(supabase, workplaceId, next, currentWeekStart, 'next')
}
