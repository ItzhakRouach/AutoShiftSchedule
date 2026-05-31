/**
 * Returns the ISO date string (YYYY-MM-DD) of the upcoming Sunday.
 * If `today` is already Sunday (getDay() === 0), returns today itself.
 * Pure function — takes `today` as a param for testability.
 */
export function upcomingWeekStartISO(today: Date): string {
  const day = today.getDay() // 0 = Sunday, 6 = Saturday
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  const sunday = new Date(today)
  sunday.setDate(today.getDate() + daysUntilSunday)
  return formatISO(sunday)
}

/** Formats a Date as YYYY-MM-DD (local time, zero-padded). */
function formatISO(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Formats an ISO date string (YYYY-MM-DD) as a short Hebrew date.
 * Examples: "2026-05-31" → "31.5", "2026-01-04" → "4.1"
 */
export function formatHebDate(iso: string): string {
  const [, mm, dd] = iso.split('-')
  return `${Number(dd)}.${Number(mm)}`
}
