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
 * to the next one. Rolls when the week is already PUBLISHED (its schedule is
 * done → collect for the next week), has already STARTED (weekStart ≤ today,
 * i.e. Sunday's "upcoming" week is the current one), or its submission
 * DEADLINE has already passed (`deadlinePassed`) — so the deadline banner and
 * the request form both advance to next week's deadline the moment submission
 * for this week closes, instead of showing a stale past date.
 */
export function shouldRollToNextWeek(
  weekStartISO: string,
  status: string,
  todayISO: string,
  deadlinePassed = false,
): boolean {
  return status === 'published' || weekStartISO <= todayISO || deadlinePassed
}

/**
 * Formats an ISO date string (YYYY-MM-DD) as a short Hebrew date.
 * Examples: "2026-05-31" → "31.5", "2026-01-04" → "4.1"
 */
export function formatHebDate(iso: string): string {
  const [, mm, dd] = iso.split('-')
  return `${Number(dd)}.${Number(mm)}`
}

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/** Hebrew weekday name (e.g. "ראשון") for a YYYY-MM-DD date. Local-time. */
export function hebrewDayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return HEB_DAYS[new Date(y, m - 1, d).getDay()]
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
