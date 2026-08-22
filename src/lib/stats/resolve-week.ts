/**
 * Resolves which published week the dashboard's unanchored ("נוכחי") week scope
 * should show. Managers typically publish NEXT week while the current one is
 * still running, so "latest published" overshoots into the future; the current
 * calendar week is what "נוכחי" means.
 *
 * Rule: the published week containing `todayISO` when it exists; otherwise the
 * most recent published week before it; otherwise (only future weeks published,
 * e.g. a brand-new workplace) the earliest upcoming one. Null when nothing is
 * published.
 */
import { currentWeekStartISO } from '@/lib/dates/week'

export function resolveCurrentWeekStart(
  publishedWeekStarts: string[],
  todayISO: string,
): string | null {
  if (publishedWeekStarts.length === 0) return null
  const [y, m, d] = todayISO.split('-').map(Number)
  const currentStart = currentWeekStartISO(new Date(y, m - 1, d))
  const sorted = [...publishedWeekStarts].sort()
  const pastOrCurrent = sorted.filter((ws) => ws <= currentStart)
  return pastOrCurrent.length > 0 ? pastOrCurrent[pastOrCurrent.length - 1] : sorted[0]
}
