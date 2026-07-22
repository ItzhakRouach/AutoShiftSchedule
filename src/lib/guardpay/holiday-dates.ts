/**
 * Holiday-date set for the GuardPay import: a shift on one of these civil dates
 * (or starting ≥16:00 on the eve of one) gets is_holiday=true and is paid like
 * Shabbat by GuardPay's salary logic. Union of the workplace's own `holidays`
 * table and the national chag list from @hebcal/core.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { israeliChagDates } from '@/lib/holidays/israel'

/** Gregorian years covered by weekStart..weekStart+7 (8 dates — the extra day
 *  covers a Saturday-night shift spilling into the next Sunday). */
export function weekYears(weekStart: string): number[] {
  const start = DateTime.fromISO(weekStart)
  const end = start.plus({ days: 7 })
  return start.year === end.year ? [start.year] : [start.year, end.year]
}

export function unionHolidaySet(tableDates: string[], years: number[]): Set<string> {
  const set = new Set<string>(tableDates)
  for (const y of years) for (const c of israeliChagDates(y)) set.add(c.date)
  return set
}

/** Loads the workplace holiday rows for the week window and unions with hebcal. */
export async function collectHolidayDates(
  supabase: SupabaseClient,
  workplaceId: string,
  weekStart: string,
): Promise<Set<string>> {
  const weekEnd = DateTime.fromISO(weekStart).plus({ days: 7 }).toISODate()!
  const { data, error } = await supabase
    .from('holidays')
    .select('date')
    .eq('workplace_id', workplaceId)
    .gte('date', weekStart)
    .lte('date', weekEnd)
  if (error) throw new Error('holidays query failed')
  const tableDates = (data ?? []).map((r) => r.date as string)
  return unionHolidaySet(tableDates, weekYears(weekStart))
}
