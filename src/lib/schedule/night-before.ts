// Pure helper: for each day D (0..6), the set of employee IDs whose previous
// shift extended PAST midnight of that day — i.e. they were physically working
// overnight when D begins. Used by the day-note UI to warn the manager when
// they're labeling someone (e.g. as רענון) the day after a night/m12_night/
// m12_15to3 shift.
//
// Cross-week: D=0 (Sunday) consults the engine's priorWeekTail (per-employee
// list of end-abs-hours from the immediately-preceding published week, with
// current week day 0 = abs hour 0). Any end abs > 0 means the shift extended
// past Sunday 00:00 → worked overnight from prior Saturday.
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'

export interface NightBeforeInput {
  /** Per-day current-week assignments (any role) with their resolved shift key. */
  byDay: Map<number, Array<{ employeeId: string; shiftKey: ShiftId }>>
  /** Engine carry-over: employeeId → list of end-abs-hours from prior week. */
  priorWeekTail: Record<string, number[]>
}

/** Per-day set of employees whose previous shift extended past midnight of D. */
export function buildNightBeforeByDay(
  args: NightBeforeInput,
): Record<number, Set<string>> {
  const out: Record<number, Set<string>> = {
    0: new Set(), 1: new Set(), 2: new Set(),
    3: new Set(), 4: new Set(), 5: new Set(), 6: new Set(),
  }
  // Current week: for D=1..6, look at assignments on day D-1 whose end abs > D*24.
  for (let prev = 0; prev < 6; prev++) {
    const D = prev + 1
    for (const a of args.byDay.get(prev) ?? []) {
      const m = SHIFT_META[a.shiftKey]
      if (!m) continue
      const endAbs = prev * 24 + m.start + m.hours
      if (endAbs > D * 24) out[D].add(a.employeeId)
    }
  }
  // Day 0: prior-week tail entries with endAbs > 0 mean the shift wrapped into
  // current week's Sunday morning hours.
  for (const empId of Object.keys(args.priorWeekTail)) {
    if ((args.priorWeekTail[empId] ?? []).some((e) => e > 0)) out[0].add(empId)
  }
  return out
}

/** Serializable shape for crossing the server→client component boundary. */
export type NightBeforeMap = Record<number, string[]>

export function toSerializable(byDay: Record<number, Set<string>>): NightBeforeMap {
  const out: NightBeforeMap = {}
  for (const [k, v] of Object.entries(byDay)) out[Number(k)] = [...v]
  return out
}
