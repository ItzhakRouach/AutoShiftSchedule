/**
 * How much of a shift falls inside the Yom Kippur fast, for the GuardPay import.
 *
 * GuardPay pays those hours at 200% and the rest at 100%, so the number sent
 * over the wire IS the pay split. All arithmetic here is on absolute instants,
 * which makes it immune to DST and to the process timezone — unlike the
 * civil-date rules the rest of the import uses.
 */
import { yomKippurWindow, type KippurWindow } from '@/lib/holidays/yom-kippur'
import { weekYears } from './holiday-dates'

/** The Yom Kippur windows of every year the week can reach (weekStart..+7d —
 *  the same span `collectHolidayDates` covers, which is exactly how far a
 *  Saturday-night 12h shift spills). */
export function kippurWindowsForWeek(weekStart: string): KippurWindow[] {
  const out: KippurWindow[] = []
  for (const year of weekYears(weekStart)) {
    const w = yomKippurWindow(year)
    if (w) out.push(w)
  }
  return out
}

/**
 * Hours of `[startISO, endISO)` that fall inside the fast, exact to the minute
 * (2 decimals) — candle lighting is not on a quarter hour, and rounding the
 * boundary either over- or under-pays. 0 when there is no overlap.
 *
 * Summing across windows is safe: they are disjoint and a shift is capped at
 * 24h, so at most one can ever match.
 */
export function kippurOverlapHours(
  startISO: string,
  endISO: string,
  windows: KippurWindow[],
): number {
  const s = Date.parse(startISO)
  const e = Date.parse(endISO)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0
  let ms = 0
  for (const w of windows) ms += Math.max(0, Math.min(e, w.endMs) - Math.max(s, w.startMs))
  return Math.round((ms / 3_600_000) * 100) / 100
}

/**
 * The holiday-date set with Yom Kippur and its eve removed.
 *
 * Yom Kippur is priced by the fast window, not by the civil date: a shift that
 * starts at 23:00 on Yom Kippur is hours past havdalah and is an ordinary
 * weekday shift. Leaving those dates in the chag set would hand it holiday
 * rates. Returns a new Set; the input is not mutated.
 */
export function withoutKippurDates(
  holidaySet: Set<string>,
  windows: KippurWindow[],
): Set<string> {
  if (windows.length === 0) return holidaySet
  const out = new Set(holidaySet)
  for (const w of windows) {
    out.delete(w.date)
    const eve = new Date(`${w.date}T00:00:00Z`)
    eve.setUTCDate(eve.getUTCDate() - 1)
    out.delete(eve.toISOString().slice(0, 10))
  }
  return out
}
