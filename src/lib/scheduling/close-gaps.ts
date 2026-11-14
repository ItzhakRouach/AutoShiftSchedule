// Closing the gaps the 8h fill leaves (pure, deterministic).
//
// Owner rule (2026-11-14): 12h day/night pairs first; override a worker's
// requested day off only as a last resort. Run strictly in that order, though,
// the greedy 12h pass can use up the people a single override would have
// freed and end with MORE cells open. So both orders are tried on copies of the
// state and the 12h-first result is kept unless the other covers more.
import type { DayMeta, EngineInput } from './types'
import type { FillState } from './dayfill'
import { openSlotsForDay } from './dayfill'
import { runTwelveFill } from './twelve-fill'
import { runCoverageRescue } from './coverage-rescue'

function cloneState(st: FillState): FillState {
  return {
    ...st,
    grid: structuredClone(st.grid),
    committed: Object.fromEntries(Object.entries(st.committed).map(([id, as]) => [id, as.map((a) => ({ ...a }))])),
    satisfied: { ...st.satisfied },
  }
}

const openCount = (input: EngineInput, st: FillState) =>
  input.days.reduce((n, d) => n + openSlotsForDay(input, st, d.index).length, 0)

function run(input: EngineInput, st: FillState, days: DayMeta[], skipTwelve: boolean, twelveFirst: boolean): void {
  const twelve = () => { st.twelve = skipTwelve ? [] : runTwelveFill(input, st, days) }
  const rescue = () => { st.overriddenOff = runCoverageRescue(input, st, days) }
  if (twelveFirst) { twelve(); rescue() } else { rescue(); twelve() }
}

/** Mutates `st` into the better of the two orders. */
export function closeGaps(input: EngineInput, st: FillState, days: DayMeta[], skipTwelve: boolean): void {
  const a = cloneState(st)
  run(input, a, days, skipTwelve, true)
  let pick = a
  if (!skipTwelve && openCount(input, a) > 0) {
    const b = cloneState(st)
    run(input, b, days, skipTwelve, false)
    if (openCount(input, b) < openCount(input, a)) pick = b
  }
  st.grid = pick.grid
  st.committed = pick.committed
  st.satisfied = pick.satisfied
  st.twelve = pick.twelve
  st.overriddenOff = pick.overriddenOff
}
