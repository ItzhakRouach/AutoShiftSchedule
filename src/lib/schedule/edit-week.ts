/**
 * Resolves WHICH week the manager's /schedule editor targets. Starting at the
 * upcoming Sunday (Israel wall clock), it rolls forward past any week that is
 * already PUBLISHED — so the moment a week is published, the editor moves on to
 * building the next one, matching the week employees are already submitting
 * requests for.
 *
 * INTENTIONALLY narrower than the employee-side roll (`pickCollectionWeek`,
 * which also rolls on week-started / deadline-passed): `locked` is exactly the
 * phase where the manager builds the schedule, and manager request-override
 * past the deadline is a feature — only publish finalizes a week. Unifying the
 * two rules would be a bug.
 */
import 'server-only'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysISO, todayInIsraelISO, upcomingWeekStartFromISO } from '@/lib/dates/week'
import { MAX_CANDIDATE_WEEKS } from '@/lib/requests/collection-week'
import { ensureUpcomingPeriodId } from './cached-reads'

export interface EditWeek {
  weekStart: string
  periodId: string
  status: 'collecting' | 'locked' | 'published'
  /** The most recent published week the resolver skipped (for the "כעת עורכים
   *  את השבוע הבא" banner + link back to it). Null when nothing was skipped. */
  skippedPublished: { periodId: string; weekStart: string } | null
}

/** Pure candidate-week walk: skip published weeks, stop at the first
 *  collecting/locked week (a week with no period row yet counts as
 *  'collecting'), or at the last candidate when everything is published. */
export function pickEditWeek(opts: {
  firstWeek: string
  statusByWeek: Record<string, string | undefined>
}): { weekStart: string; rolledPast: string[] } {
  const rolledPast: string[] = []
  for (let i = 0; ; i++) {
    const weekStart = addDaysISO(opts.firstWeek, i * 7)
    const status = opts.statusByWeek[weekStart] ?? 'collecting'
    if (status !== 'published' || i === MAX_CANDIDATE_WEEKS - 1) return { weekStart, rolledPast }
    rolledPast.push(weekStart)
  }
}

/** Per-request cached (same client-instance precondition as cached-reads.ts) so
 *  page.tsx and getScheduleView resolve the SAME week with one read. */
export const resolveEditWeek = cache(
  async (supabase: SupabaseClient, workplaceId: string): Promise<EditWeek | null> => {
    const firstWeek = upcomingWeekStartFromISO(todayInIsraelISO())
    const candidates = Array.from({ length: MAX_CANDIDATE_WEEKS }, (_, i) =>
      addDaysISO(firstWeek, i * 7),
    )
    const { data: periodRows } = await supabase
      .from('schedule_periods')
      .select('id, status, week_start_date')
      .eq('workplace_id', workplaceId)
      .in('week_start_date', candidates)

    const rowByWeek = new Map<string, { id: string; status: string }>()
    for (const r of periodRows ?? []) {
      rowByWeek.set(r.week_start_date as string, { id: r.id as string, status: r.status as string })
    }

    const { weekStart, rolledPast } = pickEditWeek({
      firstWeek,
      statusByWeek: Object.fromEntries(candidates.map((w) => [w, rowByWeek.get(w)?.status])),
    })

    const periodId =
      rowByWeek.get(weekStart)?.id ??
      (await ensureUpcomingPeriodId(supabase, workplaceId, weekStart))
    if (!periodId) return null

    const lastSkipped = rolledPast[rolledPast.length - 1]
    const skippedRow = lastSkipped ? rowByWeek.get(lastSkipped) : undefined
    return {
      weekStart,
      periodId,
      status: (rowByWeek.get(weekStart)?.status ?? 'collecting') as EditWeek['status'],
      skippedPublished: skippedRow ? { periodId: skippedRow.id, weekStart: lastSkipped } : null,
    }
  },
)
