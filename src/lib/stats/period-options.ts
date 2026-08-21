/**
 * Builds the dashboard period-picker options for a scope from the workplace's
 * PUBLISHED week starts (YYYY-MM-DD, newest first). Options only exist for
 * periods that actually have published data; `value` is the `at=` anchor the
 * stats fetch understands (week Sunday / first of month / Jan 1).
 */
import type { Scope } from './types'
import { addDaysISO } from '@/lib/dates/week'

export interface PeriodOption {
  value: string
  label: string
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function weekLabel(weekStartISO: string): string {
  const endISO = addDaysISO(weekStartISO, 6)
  const [, m1, d1] = weekStartISO.split('-').map(Number)
  const [, m2, d2] = endISO.split('-').map(Number)
  return m1 === m2 ? `${d1}–${d2}.${m1}` : `${d1}.${m1}–${d2}.${m2}`
}

export function buildPeriodOptions(scope: Scope, publishedWeekStarts: string[]): PeriodOption[] {
  if (scope === 'week') {
    const unique = [...new Set(publishedWeekStarts)]
    return unique.map((ws) => ({ value: ws, label: weekLabel(ws) }))
  }
  if (scope === 'month') {
    const unique = [...new Set(publishedWeekStarts.map((ws) => ws.slice(0, 7)))]
    return unique.map((ym) => {
      const [y, m] = ym.split('-').map(Number)
      return { value: `${ym}-01`, label: `${HEBREW_MONTHS[m - 1]} ${y}` }
    })
  }
  const unique = [...new Set(publishedWeekStarts.map((ws) => ws.slice(0, 4)))]
  return unique.map((y) => ({ value: `${y}-01-01`, label: y }))
}
