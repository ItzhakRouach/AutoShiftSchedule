// 12h auto-coverage pass (pure, deterministic). After the 8h fill leaves gaps,
// greedily cover still-uncovered (shift, role) requirements with 12h shifts.
//
// A 12h shift = ONE person occupying two consecutive 8h windows, filling the
// required role in EACH covered window (cross-role allowed: the person may fill
// a different role per window as long as they hold the role required there).
//
// Only the day/night split (m12_day + m12_night) is auto-assigned. The off-cycle
// 03-15 / 15-03 variants were intentionally removed from scheduling — a gap the
// day/night pair cannot close is left as a warning (they remain valid historical
// shift types for rendering, but the engine never assigns them).
import type {
  Assignment,
  DayMeta,
  Employee,
  EngineInput,
  TwelveHourAssignment,
  TwelveHourKey,
} from './types'
import type { FillState } from './dayfill'
import { TWELVE_HOUR_FILLS } from './fallback'
import { orderedEmployees, openSlotsForDay } from './dayfill'
import { isAssignable } from './constraints'
import { canTwelve } from './twelve-rules'
import { nightCount } from './fairness'
import {
  type Plan,
  reqOf,
  gap,
  openPairs,
  sameDayBase,
  planCover,
  removeBase,
  commitTwelve,
  uncommitTwelve,
} from './twelve-plan'
import { type AbsorbedMap, absorbKey, completePairs } from './twelve-pairing'

const PREFERRED: TwelveHourKey[] = ['m12_day', 'm12_night']

/** Hard-constraint check for `e` taking `variant` on `day`, ignoring `absorb`. */
function legal(input: EngineInput, st: FillState, e: Employee, meta: DayMeta, variant: TwelveHourKey, absorb: Assignment | null): boolean {
  const current = absorb ? st.committed[e.id].filter((x) => x !== absorb) : st.committed[e.id]
  return canTwelve({
    emp: e,
    meta,
    variant,
    request: reqOf(input, e.id, meta.index),
    current,
    settings: input.settings,
    priorTail: input.priorWeekTail?.[e.id],
    nextHead: input.nextWeekHead?.[e.id],
  })
}

/** One greedy assignment of `variant` on the day; returns true if it committed. */
function tryVariant(
  input: EngineInput,
  st: FillState,
  out: TwelveHourAssignment[],
  meta: DayMeta,
  variant: TwelveHourKey,
  absorbed: AbsorbedMap,
): boolean {
  const day = meta.index
  const slots = openPairs(input, st, day).map((p) => ({ day, shift: p.shift, roleId: p.role }))
  // A 19:00–07:00 is a night: hand it to whoever has the fewest nights so far
  // (stable sort keeps the usual candidate order among equals).
  const ordered = orderedEmployees(input, meta, st, slots)
  if (variant === 'm12_night') ordered.sort((a, b) => nightCount(st.committed[a.id]) - nightCount(st.committed[b.id]))
  for (const e of ordered) {
    const plan = planCover(input, st, e, day, variant)
    if (!plan || !legal(input, st, e, meta, variant, plan.absorb)) continue
    commitTwelve(st, out, e, day, variant, plan)
    absorbed.set(absorbKey(e.id, day), plan.absorb)
    return true
  }
  return false
}

/** Put a worker freed by displacement into an open cell of the day: an 8h if
 *  they can take one, else a 12h that closes a gap. Returns false if neither. */
function replaceHolder(
  input: EngineInput, st: FillState, out: TwelveHourAssignment[], meta: DayMeta, h: Employee, absorbed: AbsorbedMap,
): boolean {
  for (const slot of openSlotsForDay(input, st, meta.index)) {
    const ok = isAssignable({
      emp: h, meta, shift: slot.shift, roleId: slot.roleId,
      request: reqOf(input, h.id, meta.index), current: st.committed[h.id], settings: input.settings,
      priorTail: input.priorWeekTail?.[h.id], nextHead: input.nextWeekHead?.[h.id],
    })
    if (!ok) continue
    st.grid[meta.index][slot.shift][slot.roleId].push(h.id)
    st.committed[h.id].push({ employeeId: h.id, day: meta.index, shift: slot.shift, roleId: slot.roleId, is12h: false })
    return true
  }
  for (const v of PREFERRED) {
    const plan = planCover(input, st, h, meta.index, v)
    if (!plan || plan.absorb || !legal(input, st, h, meta, v, null)) continue
    commitTwelve(st, out, h, meta.index, v, plan)
    absorbed.set(absorbKey(h.id, meta.index), null)
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
  absorbed: AbsorbedMap,
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
        const restore = () => {
          st.grid[day][held.shift][held.roleId].push(holderId)
          st.committed[holderId].push(held)
        }
        if (!legal(input, st, e, meta, variant, base)) { restore(); continue }
        const plan: Plan = { rolesByShift: { [base.shift]: base.roleId, [shift]: role }, absorb: base }
        commitTwelve(st, out, e, day, variant, plan)
        // Only worth it if the displaced worker really fills another gap now —
        // otherwise the day just trades one covered cell for another.
        const holder = input.employees.find((h) => h.id === holderId)!
        if (replaceHolder(input, st, out, meta, holder, absorbed)) {
          absorbed.set(absorbKey(e.id, day), base)
          return true
        }
        uncommitTwelve(st, out, e, day, base)
        restore()
      }
    }
  }
  return false
}

/** Run the full 12h coverage pass, mutating `st`; returns canonical records. */
export function runTwelveFill(
  input: EngineInput,
  st: FillState,
  days: DayMeta[],
): TwelveHourAssignment[] {
  const out: TwelveHourAssignment[] = []
  if (!input.settings.allow12hFallback) return out

  const absorbed: AbsorbedMap = new Map()
  for (const d of days) {
    const meta = d
    // PREFERRED day/night pair: greedy fill, then displacement to free an 8h holder
    // so the pair can tile the whole day. Repeat until no progress. Any gap the pair
    // cannot close is left as a warning (off-cycle variants are no longer used).
    let moved = true
    while (moved && openPairs(input, st, d.index).length > 0) {
      moved = false
      for (const v of PREFERRED) if (tryVariant(input, st, out, meta, v, absorbed)) moved = true
      if (!moved) for (const v of PREFERRED) if (tryDisplace(input, st, out, meta, v, absorbed)) { moved = true; break }
    }
    // A 07:00–19:00 only covers noon if someone takes over at 19:00 — pair it
    // with a 19:00–07:00, or stop counting it (see twelve-pairing.ts).
    completePairs(input, st, out, meta, absorbed)
  }
  return out
}
