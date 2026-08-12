// Pure deterministic helpers for the schedule adapter (no IO).
import { addDaysISO } from '@/lib/dates/week'

/** Deterministic uint32 seed from a uuid string (FNV-1a). */
export function seedFromUuid(uuid: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < uuid.length; i++) {
    h ^= uuid.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Compute the 7 ISO dates for a week starting at `weekStartISO` (YYYY-MM-DD). */
export function weekDatesFrom(weekStartISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i))
}
