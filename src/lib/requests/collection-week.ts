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

const MAX_CANDIDATE_WEEKS = 8

/** Pure candidate-week walk: starting at `firstWeek`, roll forward per
 *  `shouldRollToNextWeek` and return the first week still collecting (or the
 *  last candidate when everything rolls). A week with no period row yet counts
 *  as 'collecting'. */
export function pickCollectionWeek(opts: {
  firstWeek: string
  todayISO: string
  statusByWeek: Record<string, string | undefined>
  hasDeadline: boolean
  deadlinePassed: (weekStart: string) => boolean
}): { weekStart: string; status: 'collecting' | 'locked' | 'published' } {
  let weekStart = opts.firstWeek
  let status = 'collecting'
  for (let i = 0; i < MAX_CANDIDATE_WEEKS; i++) {
    weekStart = addDaysISO(opts.firstWeek, i * 7)
    status = opts.statusByWeek[weekStart] ?? 'collecting'
    const roll = shouldRollToNextWeek(weekStart, opts.todayISO, {
      published: status === 'published',
      deadlinePassed: opts.hasDeadline ? opts.deadlinePassed(weekStart) : false,
      hasDeadline: opts.hasDeadline,
    })
    if (!roll) break
  }
  return { weekStart, status: status as 'collecting' | 'locked' | 'published' }
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
  const hasDeadline = dow != null && !!time

  // Bulk-prefetch the candidate weeks' period rows (one read), pick the winning
  // week purely, then materialize ONLY that week via the RPC when it has no row
  // yet — instead of an RPC + select round-trip per candidate.
  const firstWeek = upcomingWeekStartISO(now)
  const candidates = Array.from({ length: MAX_CANDIDATE_WEEKS }, (_, i) => addDaysISO(firstWeek, i * 7))
  const { data: periodRows } = await supabase
    .from('schedule_periods')
    .select('id, status, week_start_date')
    .eq('workplace_id', workplaceId)
    .in('week_start_date', candidates)

  const rowByWeek = new Map<string, { id: string; status: string }>()
  for (const r of periodRows ?? []) {
    rowByWeek.set(r.week_start_date as string, { id: r.id as string, status: r.status as string })
  }

  const { weekStart, status } = pickCollectionWeek({
    firstWeek,
    todayISO,
    statusByWeek: Object.fromEntries(candidates.map((w) => [w, rowByWeek.get(w)?.status])),
    hasDeadline,
    deadlinePassed: (wk) => isPastDeadline(now, wk, dow as number, time as string, tz),
  })

  let periodId = rowByWeek.get(weekStart)?.id ?? null
  if (!periodId) {
    const { data: pid, error: rpcError } = await supabase.rpc('ensure_upcoming_period', {
      wp: workplaceId,
      wk: weekStart,
    })
    if (rpcError || !pid) return null
    periodId = pid as string
  }

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
