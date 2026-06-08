// Coverage-preserving NIGHT-CAP pass. The generic diversity pass only does
// CROSS-day swaps, so it cannot help a worker who is booked every available day
// (e.g. a Shabbat-observer working 6 nights): there's no free day to move a
// night to. This pass does the missing SAME-day swap — exchange a worker's
// night with a co-worker's non-night shift on the SAME day — to pull anyone
// over their night cap back down, without changing coverage or who works which
// day. Reuses the validated move primitives (moveLegal re-checks every hard
// constraint AND request preservation, so requested nights are never moved).
import type { DayMeta, EngineInput } from './types'
import type { FillState } from './dayfill'
import { moveLegal, applyMove, type Move, type SlotRef } from './moves'
import { nightCount } from './fairness'

const MAX_PASSES = 200

function capOf(thresholds: Record<string, number>, id: string): number {
  return thresholds[id] ?? 3
}

/** Try to move ONE night off `dId` via a same-day swap. Returns true if it did. */
function unloadOne(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
  thresholds: Record<string, number>,
  dId: string,
  ids: string[],
): boolean {
  const dList = st.committed[dId]
  for (let di = 0; di < dList.length; di++) {
    const dNight = dList[di]
    if (dNight.shift !== 'night' || dNight.is12h) continue
    const day = dNight.day

    // Co-workers who work a NON-night 8h shift the SAME day and have room for a
    // night (won't be pushed over their own cap). Prefer the one with the fewest
    // nights, then by id, for an even spread + determinism.
    const candidates = ids
      .filter((wId) => wId !== dId)
      .map((wId) => ({
        wId,
        wi: st.committed[wId].findIndex((a) => a.day === day && a.shift !== 'night' && !a.is12h),
      }))
      .filter((c) => c.wi >= 0)
      .filter((c) => {
        const wCap = capOf(thresholds, c.wId)
        return !Number.isFinite(wCap) || nightCount(st.committed[c.wId]) < wCap
      })
      .sort(
        (a, b) =>
          nightCount(st.committed[a.wId]) - nightCount(st.committed[b.wId]) ||
          (a.wId < b.wId ? -1 : 1),
      )

    for (const c of candidates) {
      const legD: SlotRef = { empId: dId, idx: di, a: dNight }
      const legW: SlotRef = { empId: c.wId, idx: c.wi, a: st.committed[c.wId][c.wi] }
      // Occupant of legD → legW's cell (D takes the non-night), occupant of legW
      // → legD's cell (W takes the night). Same day, distinct employees.
      const move: Move = { legs: [legD, legW] }
      if (moveLegal(input, metas, st, move)) {
        applyMove(st, move)
        return true
      }
    }
  }
  return false
}

/**
 * Pull every over-cap, non-exempt worker down to their night threshold via
 * coverage-preserving same-day swaps, where legal swaps exist. Deterministic.
 */
export function runNightUnloadPass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
  thresholds: Record<string, number>,
): void {
  const ids = Object.keys(st.committed).sort()
  let changed = true
  let pass = 0
  while (changed && pass++ < MAX_PASSES) {
    changed = false
    for (const dId of ids) {
      const cap = capOf(thresholds, dId)
      if (!Number.isFinite(cap)) continue
      while (nightCount(st.committed[dId]) > cap) {
        if (!unloadOne(input, st, metas, thresholds, dId, ids)) break
        changed = true
      }
    }
  }
}
