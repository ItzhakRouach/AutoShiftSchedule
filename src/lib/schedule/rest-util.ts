// Shared pure rest-math utilities. Imported by both validate-edit-core.ts and
// candidate-status.ts so the identical interval/gap logic lives in ONE place.
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'

/** Absolute [start, end) hours a shift occupies starting on `day`. */
export function shiftInterval(day: number, shiftKey: ShiftId): [number, number] {
  const m = SHIFT_META[shiftKey]
  const start = day * 24 + m.start
  return [start, start + m.hours]
}

/** Rest gap in hours between two intervals; -1 if they overlap. */
export function gapBetween(a: [number, number], b: [number, number]): number {
  if (b[0] >= a[1]) return b[0] - a[1]
  if (a[0] >= b[1]) return a[0] - b[1]
  return -1
}
