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
import { upcomingWeekStartFromISO, addDaysISO, shouldRollToNextWeek, todayInIsraelISO } from '@/lib/dates/week'
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

/** How many consecutive weeks the resolvers may roll forward (shared with the
 *  manager-side `pickEditWeek`). */
export const MAX_CANDIDATE_WEEKS = 8

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
  for (let i = 0; ; i++) {
    const weekStart = addDaysISO(opts.firstWeek, i * 7)
    const status = (opts.statusByWeek[weekStart] ?? 'collecting') as
      | 'collecting'
      | 'locked'
      | 'published'
    const roll = shouldRollToNextWeek(weekStart, opts.todayISO, {
      published: status === 'published',
      deadlinePassed: opts.hasDeadline ? opts.deadlinePassed(weekStart) : false,
      hasDeadline: opts.hasDeadline,
    })
    if (!roll || i === MAX_CANDIDATE_WEEKS - 1) return { weekStart, status }
  }
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
  // Israel wall clock — on UTC servers the local date lags Israel by 2–3h
  // around midnight, which briefly resolved the WRONG week at the boundary.
  const todayISO = todayInIsraelISO(now)
  const hasDeadline = dow != null && !!time

  // Bulk-prefetch the candidate weeks' period rows (one read), pick the winning
  // week purely, then materialize ONLY that week via the RPC when it has no row
  // yet — instead of an RPC + select round-trip per candidate.
  const firstWeek = upcomingWeekStartFromISO(todayISO)
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
