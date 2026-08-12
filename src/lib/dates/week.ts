/**
 * Returns the ISO date string (YYYY-MM-DD) of the upcoming Sunday.
 * If `today` is already Sunday (getDay() === 0), returns today itself
 * (i.e. on Sunday the "upcoming" week is the one that begins today).
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

/** Today's date as YYYY-MM-DD, same local basis as upcomingWeekStartISO. */
export function toISODate(d: Date): string {
  return formatISO(d)
}

/** YYYY-MM-DD in UTC. For server-side (cron / DB-written-in-UTC) comparisons —
 *  deliberately distinct from the local-time `toISODate`. */
export function toISODateUTC(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * ISO date of the CURRENT week's Sunday — the Sunday of the week that contains
 * `today` (today itself when it's already Sunday). Distinct from
 * `upcomingWeekStartISO`, which looks FORWARD to the next Sunday. Used for
 * calendar-week statistics scoping.
 */
export function currentWeekStartISO(today: Date): string {
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay()) // getDay(): 0=Sun
  return formatISO(sunday)
}

/** Adds `days` to a YYYY-MM-DD date and returns the new YYYY-MM-DD. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return formatISO(new Date(y, m - 1, d + days))
}

/**
 * Whether the employee's request form should skip a given week and roll forward
 * to the next one. Always rolls past a week that has already STARTED
 * (weekStart ≤ today). Beyond that, when a submission **deadline is configured**
 * the DEADLINE governs — roll once it has passed, regardless of whether a
 * schedule was already published (a manager may publish before the deadline;
 * employees keep collecting until it passes). Only when NO deadline is set does
 * publish status govern (legacy fallback).
 */
export function shouldRollToNextWeek(
  weekStartISO: string,
  todayISO: string,
  opts: { published: boolean; deadlinePassed: boolean; hasDeadline: boolean },
): boolean {
  if (weekStartISO <= todayISO) return true
  if (opts.hasDeadline) return opts.deadlinePassed
  return opts.published
}

/**
 * Formats an ISO date string (YYYY-MM-DD) as a short Hebrew date.
 * Examples: "2026-05-31" → "31.5", "2026-01-04" → "4.1"
 */
export function formatHebDate(iso: string): string {
  const [, mm, dd] = iso.split('-')
  return `${Number(dd)}.${Number(mm)}`
}

/** Canonical Hebrew weekday names, Sunday-first (index = getDay()). */
export const HEBREW_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const

/** Canonical short Hebrew weekday marks, Sunday-first. */
export const HEBREW_WEEKDAY_SHORTS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const

/** Hebrew weekday name (e.g. "ראשון") for a YYYY-MM-DD date. Local-time. */
export function hebrewDayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return HEBREW_WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

/** True if `iso` falls within ANY of the given inclusive vacation ranges. */
export function isInVacationRange(
  iso: string,
  ranges: Array<{ date_from: string; date_to: string }>,
): boolean {
  return ranges.some((r) => iso >= r.date_from && iso <= r.date_to)
}

/**
 * Resolves the absence kind covering `iso`, or null if no range covers it.
 * If multiple ranges overlap the same day, the one with the earliest
 * `date_from` wins — a deterministic, stable tie-break.
 */
export function resolveAbsenceKind<K extends string>(
  iso: string,
  ranges: Array<{ date_from: string; date_to: string; kind: K }>,
): K | null {
  const covering = ranges.filter((r) => iso >= r.date_from && iso <= r.date_to)
  if (covering.length === 0) return null
  covering.sort((a, b) => (a.date_from < b.date_from ? -1 : a.date_from > b.date_from ? 1 : 0))
  return covering[0].kind
}
