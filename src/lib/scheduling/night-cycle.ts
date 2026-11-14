// Three-way night move (pure helper for the night-balancing passes).
//
// When neither a direct swap nor a block swap can hand one of giver g's nights
// to receiver r, a third worker x often can make room: r takes g's night, g
// takes x's shift, and x takes the shift r gave up. r's freed cell can be on
// any day, so r can take a night on a day they were free (staying within their
// weekly maximum) and the shift that blocked r's rest can go to x.
// Coverage is untouched (three occupied cells change hands); every mover is
// re-validated against all hard constraints and the request gate (moveLegal).
import type { DayMeta, EngineInput } from './types'
import type { FillState } from './dayfill'
import { moveLegal, applyMove, type Move, type RequestGate, type SlotRef } from './moves'
import { wantsNight } from './night-targets'

const byCell = (x: SlotRef, y: SlotRef) =>
  x.a.day - y.a.day || (x.a.shift < y.a.shift ? -1 : x.a.shift > y.a.shift ? 1 : 0) || (x.a.roleId < y.a.roleId ? -1 : 1)

const plainCells = (st: FillState, id: string, night: boolean): SlotRef[] =>
  st.committed[id]
    .map((a, idx) => ({ empId: id, idx, a }))
    .filter(({ a }) => !a.is12h && (a.shift === 'night') === night)
    .sort(byCell)

/** First legal r ← g-night, g ← x-cell, x ← r-cell rotation; applied in place. */
export function tryNightCycle(
  input: EngineInput, metas: Record<number, DayMeta>, st: FillState,
  g: string, r: string, requestGate?: RequestGate,
): boolean {
  const gNights = plainCells(st, g, true).filter(({ a }) => !wantsNight(input, g, a.day))
  const rCells = plainCells(st, r, false)
  const others = Object.keys(st.committed).filter((id) => id !== g && id !== r).sort()
  for (const gn of gNights) {
    for (const rc of rCells) {
      for (const x of others) {
        for (const xc of plainCells(st, x, false)) {
          // legs[k]'s occupant moves into legs[k+1]'s cell.
          const move: Move = { legs: [rc, gn, xc] }
          if (moveLegal(input, metas, st, move, { requestGate })) {
            applyMove(st, move)
            return true
          }
        }
      }
    }
  }
  return false
}
