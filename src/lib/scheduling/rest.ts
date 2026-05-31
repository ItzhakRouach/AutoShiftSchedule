// Absolute-hour rest math (ported from DesignTemplate/data.jsx).
import { SHIFT_META } from '@/lib/domain/constants'
import type { ShiftKey } from './types'

/** Absolute start hour: day*24 + shift.start */
export function shiftStartAbs(day: number, shift: ShiftKey): number {
  return day * 24 + SHIFT_META[shift].start
}

/** Absolute end hour: start + duration (night 23:00 + 8 crosses midnight). */
export function shiftEndAbs(day: number, shift: ShiftKey): number {
  const m = SHIFT_META[shift]
  return day * 24 + m.start + m.hours
}

/** Gap in hours between two shift intervals; -1 if they overlap. */
export function gapHours(
  aDay: number,
  aShift: ShiftKey,
  bDay: number,
  bShift: ShiftKey,
): number {
  const as = shiftStartAbs(aDay, aShift)
  const ae = shiftEndAbs(aDay, aShift)
  const bs = shiftStartAbs(bDay, bShift)
  const be = shiftEndAbs(bDay, bShift)
  if (bs >= ae) return bs - ae
  if (as >= be) return as - be
  return -1
}

/** True if the rest between the two shifts is >= minRestHours (no overlap). */
export function restOk(
  aDay: number,
  aShift: ShiftKey,
  bDay: number,
  bShift: ShiftKey,
  minRestHours: number,
): boolean {
  return gapHours(aDay, aShift, bDay, bShift) >= minRestHours
}
