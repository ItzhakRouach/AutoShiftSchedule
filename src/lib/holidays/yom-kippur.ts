/**
 * The Yom Kippur fast window as real instants: candle lighting on erev Yom
 * Kippur → havdalah on Yom Kippur. GuardPay pays 200% inside that window, so the
 * boundaries are money — they come from @hebcal/core rather than a hard-coded
 * clock, and the unit test pins the exact instants for several years.
 *
 * Reference city is Tel Aviv. Candle-lighting times are city-specific
 * (Jerusalem's 40-minute custom would move the boundary ~24 minutes earlier),
 * and Tel Aviv matches the times this workplace uses.
 *
 * Separate from israeliChagDates(), which collapses every chag to {date, name}
 * via render('he') and so cannot tell Yom Kippur from Sukkot.
 */
import { HebrewCalendar, Location, flags } from '@hebcal/core'
// @hebcal/core's greg() returns a Date at midnight LOCAL time, so the
// local-time toISODate keeps the civil date correct in any process timezone.
import { toISODate as toISO } from '@/lib/dates/week'

/** Absolute boundaries of one year's fast; `date` is Yom Kippur itself. */
export interface KippurWindow {
  date: string
  startMs: number
  endMs: number
}

// Location.lookup returns undefined on a miss and hebcal's city database is not
// a stable API surface — fall back to explicit coordinates so a library bump can
// never silently change (or lose) the reference point.
const TEL_AVIV =
  Location.lookup('Tel Aviv') ??
  new Location(32.08088, 34.78057, true, 'Asia/Jerusalem', 'Tel Aviv', 'IL')

const cache = new Map<number, KippurWindow | null>()

function timedEventOn(
  events: ReturnType<typeof HebrewCalendar.calendar>,
  desc: string,
  isoDate: string,
): Date | null {
  for (const ev of events) {
    if (ev.getDesc() !== desc) continue
    if (toISO(ev.getDate().greg()) !== isoDate) continue
    const t = (ev as { eventTime?: Date }).eventTime
    if (t instanceof Date) return t
  }
  return null
}

/**
 * The fast window for a Gregorian year, or null when hebcal can't supply both
 * boundaries. Memoised — the result is deterministic and at most a couple of
 * years are ever live.
 */
export function yomKippurWindow(gregYear: number): KippurWindow | null {
  const hit = cache.get(gregYear)
  if (hit !== undefined) return hit

  const chagim = HebrewCalendar.calendar({
    year: gregYear,
    isHebrewYear: false,
    il: true,
    mask: flags.CHAG,
  })
  // getDesc() is the stable English key; render('he') is a display string.
  const yk = chagim.find((ev) => ev.getDesc() === 'Yom Kippur')
  if (!yk) {
    cache.set(gregYear, null)
    return null
  }

  const ykDay = yk.getDate().greg()
  const date = toISO(ykDay)
  const eveDate = toISO(new Date(ykDay.getTime() - 24 * 3600 * 1000))

  // Candle-lighting events are only emitted with `candlelighting: true`, and a
  // whole-year query materialises ~110 weekly events for nothing — ask for the
  // three days around Yom Kippur instead.
  const timed = HebrewCalendar.calendar({
    start: new Date(ykDay.getTime() - 24 * 3600 * 1000),
    end: new Date(ykDay.getTime() + 24 * 3600 * 1000),
    il: true,
    location: TEL_AVIV,
    candlelighting: true,
  })

  // When Yom Kippur falls on Shabbat the single Friday candle lighting serves
  // both, and one havdalah closes both — no ambiguity either way.
  const start = timedEventOn(timed, 'Candle lighting', eveDate)
  const end = timedEventOn(timed, 'Havdalah', date)
  const window =
    start && end ? { date, startMs: start.getTime(), endMs: end.getTime() } : null

  cache.set(gregYear, window)
  return window
}
