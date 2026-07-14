/** Dynamic future date ranges for absence/vacation e2e flows.
 *
 * The app hides absences whose range has fully passed (requests context and
 * manager vacations both filter them), so specs MUST NOT hardcode dates —
 * they rot into invisible entries the day after the range ends.
 * Mirrors the UI format: "יום <weekday> <d>.<m>" joined with " — "
 * (see src/lib/dates/week.ts hebrewDayName/formatHebDate).
 */
const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hebLabel(d: Date): string {
  return `יום ${HEB_DAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`
}

/** A range starting `startInDays` from today, spanning `lengthDays` more days. */
export function futureRange(startInDays: number, lengthDays: number) {
  const from = new Date()
  from.setDate(from.getDate() + startInDays)
  const to = new Date(from)
  to.setDate(from.getDate() + lengthDays)
  return {
    fromISO: iso(from),
    toISO: iso(to),
    text: lengthDays === 0 ? hebLabel(from) : `${hebLabel(from)} — ${hebLabel(to)}`,
  }
}
