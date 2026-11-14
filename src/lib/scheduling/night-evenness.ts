// Coverage-preserving NIGHT-EVENNESS pass. Night-unload only fires when a
// worker is OVER their threshold; this pass actively evens nights out BELOW
// the caps: while some finite-threshold worker holds ≥2 more nights than
// another, swap one of the giver's plain-8h NIGHT cells with one of the
// receiver's plain-8h NON-night cells (same-day AND cross-day — moveLegal
// re-validates every hard constraint + request preservation, so requested
// nights never move and off/availability/rest/one-per-day/maxShifts always
// win). 2-swaps first; when rest blocks every one, a block swap of a few
// consecutive days (block-swap.ts).
import type { DayMeta, EngineInput } from './types'
import type { FillState } from './dayfill'
import { moveLegal, applyMove, type Move, type RequestGate, type SlotRef } from './moves'
import { nightCount } from './fairness'
import { DEFAULT_NIGHT_CAP, wantsNight } from './night-targets'
import { tryBlockSwap } from './block-swap'
import { preservesRequestFloorFor } from './request-gate'

const MAX_PASSES = 200

const capOf = (thresholds: Record<string, number>, id: string): number =>
  thresholds[id] ?? DEFAULT_NIGHT_CAP

/**
 * Swap one of g's plain-8h NIGHT cells with one of r's plain-8h NON-night
 * cells; true if a legal swap ran. Shared with the night-FLOOR pass, which
 * passes a relaxed `requestGate` (see night-floor.ts) — hence the hook.
 * Deterministic: canonical cell enumeration, first-legal-accept.
 */
export function tryNightForNonNightSwap(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
  g: string,
  r: string,
  requestGate?: RequestGate,
): boolean {
  const gNights = st.committed[g]
    .map((a, idx) => ({ a, idx }))
    // A night the giver asked for (and only for) is theirs to keep.
    .filter(({ a }) => a.shift === 'night' && !a.is12h && !wantsNight(input, g, a.day))
    .sort((x, y) => x.a.day - y.a.day || (x.a.roleId < y.a.roleId ? -1 : 1))
  const rCells = st.committed[r]
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => a.shift !== 'night' && !a.is12h)
    .sort(
      (x, y) =>
        x.a.day - y.a.day ||
        (x.a.shift < y.a.shift ? -1 : x.a.shift > y.a.shift ? 1 : 0) ||
        (x.a.roleId < y.a.roleId ? -1 : 1),
    )
  for (const gn of gNights) {
    for (const rc of rCells) {
      const legG: SlotRef = { empId: g, idx: gn.idx, a: gn.a }
      const legR: SlotRef = { empId: r, idx: rc.idx, a: rc.a }
      const move: Move = { legs: [legG, legR] } // g → r's cell, r → g's night
      if (moveLegal(input, metas, st, move, { requestGate })) {
        applyMove(st, move)
        return true
      }
    }
  }
  // No single swap is legal — usually rest: the receiver's next-morning shift
  // follows the night. Exchange a short run of days instead (block-swap.ts).
  for (const gn of gNights) {
    if (tryBlockSwap(input, metas, st, g, r, gn.a.day, requestGate)) return true
  }
  return false
}

/**
 * Split nights as evenly as the hard constraints, coverage and requests allow
 * across the finite-threshold pool (night-only workers are exempt both ways).
 * A swap only fires at a giver/receiver gap ≥ 2, which strictly decreases
 * Σ nights² — a bounded integer, so the loop terminates; MAX_PASSES is
 * belt-and-braces. Deterministic: sorted ids, count-then-id orderings,
 * canonical cell enumeration, first-legal-accept.
 */
export function runNightEvennessPass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
  thresholds: Record<string, number>,
): void {
  const pool = Object.keys(st.committed)
    .sort()
    .filter((id) => Number.isFinite(capOf(thresholds, id)))
  if (pool.length < 2) return

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const counts: Record<string, number> = {}
    for (const id of pool) counts[id] = nightCount(st.committed[id])
    const givers = [...pool].sort((a, b) => counts[b] - counts[a] || (a < b ? -1 : 1))
    const receivers = [...pool].sort((a, b) => counts[a] - counts[b] || (a < b ? -1 : 1))
    if (counts[givers[0]] - counts[receivers[0]] < 2) return

    let moved = false
    outer: for (const g of givers) {
      for (const r of receivers) {
        if (r === g) continue
        if (counts[g] - counts[r] < 2) break // receivers ascending → no later r closes the gap
        if (counts[r] + 1 > capOf(thresholds, r)) continue // receiver stays ≤ cap
        // Owner rule (2026-11-14): nights are shared equally whatever people
        // marked. Prefer a move that costs no granted request; failing that,
        // one may spend a request — never below half of what the worker asked
        // for (relaxed gate), and never a night they asked for.
        if (
          tryNightForNonNightSwap(input, st, metas, g, r) ||
          tryNightForNonNightSwap(input, st, metas, g, r, preservesRequestFloorFor)
        ) {
          moved = true
          break outer
        }
      }
    }
    if (!moved) return
  }
}
