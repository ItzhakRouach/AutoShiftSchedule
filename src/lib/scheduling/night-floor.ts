// Coverage-preserving NIGHT-FLOOR pass — the lower-bound counterpart to
// night-unload (upper bound) and night-evenness (spread).
//
// The thresholds in night-targets are CAPS only, and both night-unload and
// night-evenness go through the STRICT request gate, which forbids any drop in
// satisfied requests. So an employee who requests day shifts all week satisfies
// every request and legitimately escapes nights entirely — nothing in the
// pipeline has the authority to correct it, because requests rank above
// fairness (scoring.ts steps 3-4 vs step 5).
//
// This pass is that authority, narrowly scoped: while someone sits BELOW their
// night floor, take a night from someone who holds more (and who stays at/above
// their OWN floor) via the same validated night-for-non-night swap, using the
// RELAXED request gate — which may spend a granted request but never takes an
// employee below their own floorTarget (half their requests, min 2).
//
// Coverage, all 8 hard constraints and per-employee shift counts are invariant
// (it is a swap, gated by moveLegal). Termination: every applied swap strictly
// decreases Σ max(0, floor − nights)² — the receiver's deficit drops by one and
// no giver is ever allowed to fall below their own floor, so no deficit grows.
import type { DayMeta, EngineInput } from './types'
import type { FillState } from './dayfill'
import { nightCount } from './fairness'
import { tryNightForNonNightSwap } from './night-evenness'
import { preservesRequestFloorFor } from './request-gate'
import { DEFAULT_NIGHT_CAP } from './night-targets'

const MAX_PASSES = 200

const capOf = (thresholds: Record<string, number>, id: string): number =>
  thresholds[id] ?? DEFAULT_NIGHT_CAP

/**
 * Lift everyone to their night floor where the hard constraints, coverage and
 * the request FLOOR allow. Deterministic: sorted ids, deficit-then-id receiver
 * order, nights-then-id giver order, first-legal-accept.
 */
export function runNightFloorPass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
  thresholds: Record<string, number>,
  floors: Record<string, number>,
): void {
  const ids = Object.keys(st.committed).sort()
  const floorOf = (id: string) => floors[id] ?? 0

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const nights: Record<string, number> = {}
    for (const id of ids) nights[id] = nightCount(st.committed[id])

    // Neediest first; ties by id for reproducibility.
    const receivers = ids
      .filter((id) => nights[id] < floorOf(id))
      .sort(
        (a, b) =>
          floorOf(b) - nights[b] - (floorOf(a) - nights[a]) || (a < b ? -1 : 1),
      )
    if (receivers.length === 0) return

    let moved = false
    outer: for (const r of receivers) {
      if (nights[r] + 1 > capOf(thresholds, r)) continue // never breach r's cap
      const givers = ids
        .filter(
          (g) =>
            g !== r &&
            nights[g] > nights[r] &&
            nights[g] - 1 >= floorOf(g), // a giver never drops below its own floor
        )
        .sort((a, b) => nights[b] - nights[a] || (a < b ? -1 : 1))
      for (const g of givers) {
        if (tryNightForNonNightSwap(input, st, metas, g, r, preservesRequestFloorFor)) {
          moved = true
          break outer
        }
      }
    }
    if (!moved) return
  }
}
