import type { EmpBalanceRow } from './emp-balance'

/** "4 משמרות השבוע · לילה אחד · בקשות: 1 מתוך 3" — a worker's week in one line,
 *  shown next to each candidate so the fairest pick is visible while assigning. */
export function balanceLine(row: Pick<EmpBalanceRow, 'total' | 'counts' | 'asked' | 'got'>): string {
  const parts: string[] = []
  parts.push(row.total === 0 ? 'אין משמרות השבוע' : row.total === 1 ? 'משמרת אחת השבוע' : `${row.total} משמרות השבוע`)
  const nights = row.counts.night + row.counts.m12_night
  if (nights === 1) parts.push('לילה אחד')
  else if (nights > 1) parts.push(`${nights} לילות`)
  if (row.asked > 0) parts.push(`בקשות: ${row.got} מתוך ${row.asked}`)
  return parts.join(' · ')
}

/** True when the worker already carries clearly more than the roster average. */
export function isAboveAverage(total: number, rows: Pick<EmpBalanceRow, 'total'>[]): boolean {
  if (rows.length === 0) return false
  const avg = rows.reduce((s, r) => s + r.total, 0) / rows.length
  return total >= avg + 1
}
