import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isPastDeadline } from '@/lib/deadline/compute'

/**
 * The status a period should hold when it is NOT published — driven by the
 * request deadline:
 *   - 'collecting' while the deadline hasn't passed (requests still open)
 *   - 'locked' once the deadline is past (requests closed, build the schedule)
 *
 * Used when unpublishing/clearing so a manager iterating BEFORE the deadline
 * doesn't accidentally close the worker request window. If no deadline is
 * configured, the period stays open ('collecting') — the lock cron also skips
 * deadline-less workplaces. Best-effort: on any read error, falls back to
 * 'locked' (the previous behavior).
 */
export async function statusForDeadline(
  admin: SupabaseClient,
  workplaceId: string,
  periodId: string,
): Promise<'collecting' | 'locked'> {
  const { data: period } = await admin
    .from('schedule_periods')
    .select('week_start_date')
    .eq('id', periodId)
    .maybeSingle()
  if (!period?.week_start_date) return 'locked'

  const { data: settings } = await admin
    .from('workplace_settings')
    .select('request_deadline_dow, request_deadline_time')
    .eq('workplace_id', workplaceId)
    .maybeSingle()

  const dow = settings?.request_deadline_dow as number | null | undefined
  const time = settings?.request_deadline_time as string | null | undefined
  if (dow == null || !time) return 'collecting' // no deadline ⇒ window stays open

  const { data: wp } = await admin
    .from('workplaces')
    .select('timezone')
    .eq('id', workplaceId)
    .maybeSingle()
  const tz = (wp?.timezone as string | null | undefined) ?? 'Asia/Jerusalem'

  return isPastDeadline(new Date(), period.week_start_date as string, dow, time, tz)
    ? 'locked'
    : 'collecting'
}
