// Pairing step of the 12h pass (pure, deterministic).
//
// The grid counts a 07:00–19:00 shift (m12_day) toward the whole noon cell, but
// that worker leaves at 19:00. The cell is only really covered when someone
// who holds the same role is on site 19:00–23:00: a 19:00–07:00 shift
// (m12_night). The greedy pass never creates that partner when the night cell
// is already staffed by a normal 23:00–07:00 shift, which left four hours with
// nobody while the day reported "covered".
//
// For every day shift without a partner this step:
//   1. UPGRADES an 8h night worker of that role to 19:00–07:00 (same night
//      cell, same role, no extra shift — four more hours), choosing whoever
//      carries the fewest 12h shifts so the load spreads; or
//   2. MOVES a same-day morning/noon worker of that role over to 19:00–07:00
//      in an open night cell (the owner's own fix); or, failing both,
//   3. UNDOES the day shift back to the 8h it absorbed, so the noon cell is
//      reported open instead of falsely covered.
import type { Assignment, DayMeta, Employee, EngineInput, TwelveHourAssignment } from './types'
import type { FillState } from './dayfill'
import { canTwelve } from './twelve-rules'
import { reqOf, removeBase } from './twelve-plan'
import { nightCount } from './fairness'

/** `${employeeId}:${day}` → the 8h shift a 12h absorbed when it was created
 *  (null when the 12h was placed on a free worker). */
export type AbsorbedMap = Map<string, Assignment | null>

export const absorbKey = (employeeId: string, day: number) => `${employeeId}:${day}`

interface Need {
  rec: TwelveHourAssignment
  /** Role of the noon cell this day shift is counted toward. */
  role: string
}

/** Day shifts on `day` that no 19:00–07:00 worker of the right role relieves.
 *  Bipartite matching (augmenting paths) so a flexible night worker is not
 *  wasted on a need that someone else could also meet. */
function unpairedNeeds(input: EngineInput, out: TwelveHourAssignment[], day: number): Need[] {
  const needs: Need[] = out
    .filter((t) => t.day === day && t.variant === 'm12_day' && t.rolesByShift.noon)
    .map((rec) => ({ rec, role: rec.rolesByShift.noon! }))
  const empById = new Map(input.employees.map((e) => [e.id, e]))
  const partners = out.filter((t) => t.day === day && t.variant === 'm12_night').map((t) => t.employeeId)
  const partnerOf = new Map<string, number>() // partner id → index into needs

  const tryMatch = (ni: number, seen: Set<string>): boolean => {
    for (const p of partners) {
      if (seen.has(p) || !empById.get(p)?.roleIds.includes(needs[ni].role)) continue
      seen.add(p)
      const held = partnerOf.get(p)
      if (held === undefined || tryMatch(held, seen)) {
        partnerOf.set(p, ni)
        return true
      }
    }
    return false
  }
  const matched = new Set<number>()
  needs.forEach((_, ni) => { if (tryMatch(ni, new Set())) matched.add(ni) })
  // Re-read: augmenting can move earlier needs between partners but never unmatches one.
  return needs.filter((_, ni) => matched.has(ni) === false)
}

/** An 8h night worker on `day` who holds `role` and may legally start at 19:00. */
function pickUpgrade(
  input: EngineInput, st: FillState, out: TwelveHourAssignment[], meta: DayMeta, role: string,
): { e: Employee; night: Assignment } | null {
  const twelveLoad = (id: string) => out.filter((t) => t.employeeId === id).length
  const candidates: { e: Employee; night: Assignment }[] = []
  for (const e of input.employees) {
    if (!e.roleIds.includes(role)) continue
    const night = st.committed[e.id].find((a) => a.day === meta.index && a.shift === 'night' && !a.is12h)
    if (!night) continue
    const legal = canTwelve({
      emp: e, meta, variant: 'm12_night',
      request: reqOf(input, e.id, meta.index),
      current: st.committed[e.id].filter((a) => a !== night),
      settings: input.settings,
      priorTail: input.priorWeekTail?.[e.id],
      nextHead: input.nextWeekHead?.[e.id],
    })
    if (legal) candidates.push({ e, night })
  }
  candidates.sort((a, b) => twelveLoad(a.e.id) - twelveLoad(b.e.id) || a.e.id.localeCompare(b.e.id))
  return candidates[0] ?? null
}

/**
 * Nobody of that role is on the night: move a same-day morning/noon worker who
 * holds `role` over to 19:00–07:00 in an OPEN night cell. They leave one 8h
 * cell (−1) to keep the day shift's noon (+1) and fill the night (+1). Fewest
 * nights first. Returns false if no such worker can legally start at 19:00.
 */
function moveOverToNight(
  input: EngineInput, st: FillState, out: TwelveHourAssignment[], meta: DayMeta, role: string,
  exclude: string, absorbed: AbsorbedMap,
): boolean {
  const day = meta.index
  const openNightRole = (e: Employee) =>
    Object.keys(input.requirements[day]?.night ?? {}).find(
      (r) => e.roleIds.includes(r) && st.grid[day].night[r].length < (input.requirements[day]?.night?.[r] ?? 0),
    )
  const candidates = input.employees
    .filter((e) => e.id !== exclude && e.roleIds.includes(role))
    .map((e) => ({ e, cur: st.committed[e.id].find((a) => a.day === day && !a.is12h && a.shift !== 'night'), nightRole: openNightRole(e) }))
    .filter((c): c is { e: Employee; cur: Assignment; nightRole: string } => !!c.cur && !!c.nightRole)
    .filter(({ e, cur }) => canTwelve({
      emp: e, meta, variant: 'm12_night', request: reqOf(input, e.id, day),
      current: st.committed[e.id].filter((a) => a !== cur), settings: input.settings,
      priorTail: input.priorWeekTail?.[e.id], nextHead: input.nextWeekHead?.[e.id],
    }))
    .sort((a, b) => nightCount(st.committed[a.e.id]) - nightCount(st.committed[b.e.id]) || a.e.id.localeCompare(b.e.id))
  const pick = candidates[0]
  if (!pick) return false
  removeBase(st, pick.cur)
  st.grid[day].night[pick.nightRole].push(pick.e.id)
  st.committed[pick.e.id].push({ employeeId: pick.e.id, day, shift: 'night', roleId: pick.nightRole, is12h: true, variant: 'm12_night' })
  out.push({ employeeId: pick.e.id, day, variant: 'm12_night', rolesByShift: { night: pick.nightRole } })
  absorbed.set(absorbKey(pick.e.id, day), pick.cur)
  return true
}

/** Turn an unrelieved 07:00–19:00 back into the 8h shift it came from. */
function undoDayShift(st: FillState, out: TwelveHourAssignment[], rec: TwelveHourAssignment, absorbed: AbsorbedMap): void {
  const { employeeId: id, day } = rec
  const mine = st.committed[id].filter((a) => a.day === day && a.is12h && a.variant === 'm12_day')
  for (const a of mine) {
    const cell = st.grid[day][a.shift][a.roleId]
    const gi = cell.indexOf(id)
    if (gi >= 0) cell.splice(gi, 1)
  }
  st.committed[id] = st.committed[id].filter((a) => !mine.includes(a))
  // The shift the worker held before the 12h absorbed it; a worker who was free
  // keeps the morning half as a plain 8h.
  const before = absorbed.get(absorbKey(id, day))
  const keep = before ?? mine.find((a) => a.shift === 'morning') ?? null
  if (keep) {
    st.grid[day][keep.shift][keep.roleId].push(id)
    st.committed[id].push({ employeeId: id, day, shift: keep.shift, roleId: keep.roleId, is12h: false })
  }
  out.splice(out.indexOf(rec), 1)
  absorbed.delete(absorbKey(id, day))
}

/** Make every counted 07:00–19:00 on `meta`'s day a real pair, or undo it. */
export function completePairs(
  input: EngineInput, st: FillState, out: TwelveHourAssignment[], meta: DayMeta, absorbed: AbsorbedMap,
): void {
  // Each round either upgrades one night worker or undoes one day shift, so
  // the number of unpaired day shifts strictly falls.
  for (;;) {
    const need = unpairedNeeds(input, out, meta.index)[0]
    if (!need) return
    const up = pickUpgrade(input, st, out, meta, need.role)
    if (!up) {
      if (!moveOverToNight(input, st, out, meta, need.role, need.rec.employeeId, absorbed)) {
        undoDayShift(st, out, need.rec, absorbed)
      }
      continue
    }
    up.night.is12h = true
    up.night.variant = 'm12_night'
    out.push({ employeeId: up.e.id, day: meta.index, variant: 'm12_night', rolesByShift: { night: up.night.roleId } })
    absorbed.set(absorbKey(up.e.id, meta.index), { ...up.night, is12h: false, variant: undefined })
  }
}
