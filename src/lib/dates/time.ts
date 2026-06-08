/**
 * Normalise a time string to canonical `HH:MM`.
 *
 * Postgres `time` columns read back as `"HH:MM:SS"` (e.g. `"18:00:00"`), while
 * `<input type="time">` and our validation use `"HH:MM"`. `hhmm()` makes both
 * consistent by taking the first 5 chars. Returns '' for null/undefined.
 */
export function hhmm(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 5)
}
