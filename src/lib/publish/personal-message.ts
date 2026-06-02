/**
 * Pure helper: builds the personal Hebrew WhatsApp message listing one
 * employee's shifts for a week. No I/O — unit-testable in isolation.
 */

export interface PersonalShift {
  /** 0 = Sunday … 6 = Saturday */
  day: number
  /** shift_type key (morning/noon/night/m12_*) — used only for ordering */
  shiftKey: string
  /** human label for the shift, e.g. 'בוקר' / 'לילה 12ש׳' */
  shiftLabel: string
  /** role name, e.g. 'מאבטח' */
  roleName: string
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

// Lower sort index = earlier in the day. Unknown keys sort last.
const SHIFT_ORDER: Record<string, number> = {
  m12_3to15: 0,
  morning: 1,
  m12_day: 1,
  noon: 2,
  m12_15to3: 2,
  night: 3,
  m12_night: 3,
}

function shiftRank(key: string): number {
  return SHIFT_ORDER[key] ?? 9
}

/**
 * Build the message body. When the employee has no shifts, returns a friendly
 * "no shifts this week" note so they still get a definitive answer.
 */
export function buildPersonalMessage(
  name: string,
  weekLabel: string,
  shifts: PersonalShift[],
): string {
  if (shifts.length === 0) {
    return `שלום ${name},\nלא שובצת למשמרות בשבוע ${weekLabel}.`
  }

  const ordered = shifts
    .slice()
    .sort((a, b) => a.day - b.day || shiftRank(a.shiftKey) - shiftRank(b.shiftKey))

  const lines = ordered.map(
    (s) => `• יום ${DAY_NAMES[s.day] ?? s.day} – ${s.shiftLabel} (${s.roleName})`,
  )

  return `שלום ${name},\nהמשמרות שלך לשבוע ${weekLabel}:\n${lines.join('\n')}`
}
