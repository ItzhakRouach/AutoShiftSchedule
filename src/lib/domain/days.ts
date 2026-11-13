/** Hebrew weekday names, Sunday-first (day index 0..6 as stored in the DB). */
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const

/** "יום ראשון" … "יום שישי", and just "שבת" for Saturday. */
export function dayTitle(dayIndex: number): string {
  return dayIndex === 6 ? 'שבת' : `יום ${DAY_NAMES[dayIndex] ?? ''}`
}
