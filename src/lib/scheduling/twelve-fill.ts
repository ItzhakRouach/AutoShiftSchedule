// 12h auto-coverage pass (pure, deterministic). After the 8h fill leaves gaps,
// greedily cover still-uncovered (shift, role) requirements with 12h shifts.
//
// A 12h shift = ONE person occupying two consecutive 8h windows, filling the
// required role in EACH covered window (cross-role allowed: the person may fill
// a different role per window as long as they hold the role required there).
//
// Preference (STRICT): day/night split (m12_day + m12_night) first; the
// 03-15 / 15-03 variants are used ONLY as a last resort, when day/night cannot
// close the remaining gaps for that day.
import type {
  Assignment,
  DayMeta,
  Employee,
  EngineInput,
  TwelveHourAssignment,
  TwelveHourKey,
} from './types'
import type { FillState } from './dayfill'
import { TWELVE_HOUR_FILLS, TWELVE_HOUR_PREFERENCE } from './fallback'
import { orderedEmployees } from './dayfill'
import { canTwelve } from './twelve-rules'
import {
  type Plan,
  reqOf,
  gap,
  openPairs,
  sameDayBase,
  planCover,
  removeBase,
  commitTwelve,
} from './twelve-plan'

const PREFERRED: TwelveHourKey[] = ['m12_day', 'm12_night']

/** Hard-constraint check for `e` taking `variant` on `day`, ignoring `absorb`. */
function legal(input: EngineInput, st: FillState, e: Employee, meta: DayMeta, variant: TwelveHourKey, absorb: Assignment | null): boolean {
  const current = absorb ? st.committed[e.id].filter((x) => x !== absorb) : st.committed[e.id]
  return canTwelve({ emp: e, meta, variant, request: reqOf(input, e.id, meta.index), current, settings: input.settings })
}

/** One greedy assignment of `variant` on the day; returns true if it committed. */
function tryVariant(
  input: EngineInput,
  st: FillState,
  out: TwelveHourAssignment[],
  meta: DayMeta,
  variant: TwelveHourKey,
): boolean {
  const day = meta.index
  const slots = openPairs(input, st, day).map((p) => ({ day, shift: p.shift, roleId: p.role }))
  for (const e of orderedEmployees(input, meta, st, slots)) {
    const plan = planCover(input, st, e, day, variant)
    if (!plan || !legal(input, st, e, meta, variant, plan.absorb)) continue
    commitTwelve(st, out, e, day, variant, plan)
    return true
  }
  return false
}

/**
 * Displacement (monotonic): when a PREFERRED-pair variant for `e` could close an
 * open gap if it also took a window currently held by another employee `h` whose
 * ONLY same-day commitment is that single 8h. We displace `h`, commit `e`'s 12h,
 * then the freed `h` is re-covered by a later step. Applied ONLY when (a) `e`'s
 * 12h is legal and (b) another open gap remains this day that the freed `h` can
 * fill — so it always yields a net coverage gain and terminates. Returns true if
 * a displacement was committed.
 */
function tryDisplace(
  input: EngineInput,
  st: FillState,
  out: TwelveHourAssignment[],
  meta: DayMeta,
  variant: TwelveHourKey,
): boolean {
  const day = meta.index
  for (const e of input.employees) {
    const fills = TWELVE_HOUR_FILLS[variant]
    const base = sameDayBase(st, e, day)
    if (!base || !fills.includes(base.shift)) continue // need an absorbable anchor
    for (const shift of fills) {
      if (shift === base.shift) continue
      const roleReq = input.requirements[day]?.[shift]
      if (!roleReq) continue
      for (const role of Object.keys(roleReq)) {
        if (!e.roleIds.includes(role)) continue
        if (gap(input, st, day, shift, role) > 0) continue // not contended → normal path
        const holderId = st.grid[day][shift][role].find((h) => {
          if (h === e.id) return false
          const sameDay = st.committed[h].filter((a) => a.day === day)
          return sameDay.length === 1 && !sameDay[0].is12h
        })
        if (!holderId) continue
        const held = st.committed[holderId].find((a) => a.day === day)!
        removeBase(st, held)
        const holderFree = !st.committed[holderId].some((a) => a.day === day)
        const reusable = holderFree && openPairs(input, st, day).some((p) => p.shift !== shift)
        if (!legal(input, st, e, meta, variant, base) || !reusable) {
          st.grid[day][held.shift][held.roleId].push(holderId)
          st.committed[holderId].push(held)
          continue
        }
        const plan: Plan = { rolesByShift: { [base.shift]: base.roleId, [shift]: role }, absorb: base }
        commitTwelve(st, out, e, day, variant, plan)
        return true
      }
    }
  }
  return false
}

/** Run the full 12h coverage pass, mutating `st`; returns canonical records. */
export function runTwelveFill(input: EngineInput, st: FillState): TwelveHourAssignment[] {
  const out: TwelveHourAssignment[] = []
  if (!input.settings.allow12hFallback) return out
  const metas: Record<number, DayMeta> = {}
  for (const d of input.days) metas[d.index] = d

  for (const d of input.days) {
    const meta = metas[d.index]
    // Phase 1 — PREFERRED day/night pair: greedy fill, then displacement to free
    // an 8h holder so the pair can tile the whole day. Repeat until no progress.
    let moved = true
    while (moved && openPairs(input, st, d.index).length > 0) {
      moved = false
      for (const v of PREFERRED) if (tryVariant(input, st, out, meta, v)) moved = true
      if (!moved) for (const v of PREFERRED) if (tryDisplace(input, st, out, meta, v)) { moved = true; break }
    }
    // Phase 2 — LAST RESORT 03-15 / 15-03, only for gaps the pair could not close.
    for (const v of TWELVE_HOUR_PREFERENCE) {
      if (PREFERRED.includes(v)) continue
      while (openPairs(input, st, d.index).length > 0 && tryVariant(input, st, out, meta, v)) { /* loop */ }
    }
  }
  return out
}
