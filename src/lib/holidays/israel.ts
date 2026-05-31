/**
 * Pure helper: returns Israeli melacha-forbidden chag dates for a Gregorian year.
 * Uses @hebcal/core flags.CHAG bitmask (value 1) which marks all yomim tovim
 * where work is forbidden: Rosh Hashana (2 days), Yom Kippur, Sukkot I,
 * Shmini Atzeret, Pesach I & VII, Shavuot.
 * Israeli schedule (il:true) gives the correct 1-day yom tov for Diaspora 2-day chagim.
 */
import { HebrewCalendar, flags } from '@hebcal/core'

export interface ChagDate {
  date: string   // YYYY-MM-DD (UTC)
  name: string   // Hebrew name via render('he')
}

/**
 * @hebcal/core's greg() returns a Date at midnight local time.
 * Use local-time accessors so the civil date matches regardless of the process timezone.
 */
function toISO(g: Date): string {
  const yyyy = g.getFullYear()
  const mm = String(g.getMonth() + 1).padStart(2, '0')
  const dd = String(g.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Returns the Israeli melacha-forbidden chag dates for `gregYear`.
 * Filtered to events whose mask has the CHAG bit set (flags.CHAG = 1).
 * Sorted by date ascending.
 */
export function israeliChagDates(gregYear: number): ChagDate[] {
  const events = HebrewCalendar.calendar({
    year: gregYear,
    isHebrewYear: false,
    il: true,
    mask: flags.CHAG,
  })

  return events
    .filter((ev) => (ev.mask & flags.CHAG) !== 0)
    .map((ev) => ({
      date: toISO(ev.getDate().greg()),
      name: ev.render('he'),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
