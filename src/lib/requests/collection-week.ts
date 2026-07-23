/**
 * Resolves WHICH week an employee is currently collecting requests for, shared
 * by /me (deadline banner) and /me/requests (the request form) so both advance
 * identically.
 *
 * Starting at the upcoming Sunday, it rolls forward past any week that is already
 * PUBLISHED, has already STARTED, or whose submission DEADLINE has passed — so
 * the moment this week's deadline closes, both surfaces show NEXT week's
 * deadline instead of a stale past date. Employees can't INSERT periods, so the
 * SECURITY DEFINER `ensure_upcoming_period` RPC lazily materializes each
 * candidate week.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { upcomingWeekStartISO, addDaysISO, shouldRollToNextWeek, toISODate } from '@/lib/dates/week'
import { isPastDeadline } from '@/lib/deadline/compute'

export interface CollectionWeek {
  weekStart: string
  periodId: string
  status: 'collecting' | 'locked' | 'published'
  dow: number | null
  time: string | null
  tz: string
  maxOffDaysPerWeek: number | null
}

export async function resolveCollectionWeek(
  supabase: SupabaseClient,
  workplaceId: string,
  now: Date,
): Promise<CollectionWeek | null> {
  const [{ data: settingsRow }, { data: wpRow }] = await Promise.all([
    supabase
      .from('workplace_settings')
      .select('request_deadline_dow, request_deadline_time, max_off_days_per_week')
      .eq('workplace_id', workplaceId)
      .maybeSingle(),
    supabase.from('workplaces').select('timezone').eq('id', workplaceId).maybeSingle(),
  ])

  const dow = (settingsRow?.request_deadline_dow as number | null | undefined) ?? null
  const time = (settingsRow?.request_deadline_time as string | null | undefined) ?? null
  const tz = (wpRow?.timezone as string | null | undefined) ?? 'Asia/Jerusalem'
  const maxOffDaysPerWeek =
    (settingsRow?.max_off_days_per_week as number | null | undefined) ?? null
  const todayISO = toISODate(now)

  let weekStart = upcomingWeekStartISO(now)
  let periodId: string | null = null
  let status = 'collecting'
  for (let i = 0; i < 8; i++) {
    const { data: pid, error: rpcError } = await supabase.rpc('ensure_upcoming_period', {
      wp: workplaceId,
      wk: weekStart,
    })
    if (rpcError || !pid) return null
    periodId = pid as string
    const { data: pr } = await supabase
      .from('schedule_periods')
      .select('status')
      .eq('id', periodId)
      .maybeSingle()
    status = (pr?.status as string | undefined) ?? 'collecting'
    const deadlinePassed =
      dow != null && time ? isPastDeadline(now, weekStart, dow, time, tz) : false
    if (shouldRollToNextWeek(weekStart, status, todayISO, deadlinePassed)) {
      weekStart = addDaysISO(weekStart, 7)
      continue
    }
    break
  }
  if (!periodId) return null

  return {
    weekStart,
    periodId,
    status: status as 'collecting' | 'locked' | 'published',
    dow,
    time,
    tz,
    maxOffDaysPerWeek,
  }
}
