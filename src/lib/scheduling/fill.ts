// Shared fill routine (FIX B): the SINGLE source of truth for how slots get
// staffed. Both generateSchedule and checkFeasibility run THIS, so feasibility
// can never disagree with the grid. Pure & deterministic.
import type { EngineInput } from './types'
import { emptyGrid } from './grid'
import type { FillState } from './dayfill'
import { runTwelveFill } from './twelve-fill'
import { runDiversityPass, buildNightThresholds } from './diversity'
import { runNightUnloadPass } from './night-unload'
import { runSeniorRolePass } from './senior-role'
import { runManagerBalancePass } from './manager-balance'
import { runNightThenOffPass } from './night-then-off'
import { runCoverageRescue } from './coverage-rescue'
import { satisfiedCount as recountSatisfied } from './request-gate'
import { timed } from './timing'
import {
  buildLotteryRanks,
  carryOverRound,
  generalFill,
  honorRequestsRound,
  metaMap,
  mustAcceptRound,
} from './fill-rounds'

/**
 * Run the engine's real fill and return the committed FillState. This is the
 * exact path generateSchedule uses; checkFeasibility reuses it so that
 * feasibility.maxStaffable == coverage.filledSlots ALWAYS.
 *
 * When `skipTwelve` is true the 12h auto-coverage pass is NOT run — used to
 * measure the 8h-ONLY staffable count so feasibility can tell "needs12h" (8h
 * short but 12h closes more) from "short" (12h cannot help). The default path
 * runs the full 8h + 12h fill.
 */
export function runFill(
  input: EngineInput,
  skipTwelve = false,
  skipDiversity = false,
  skipNightThenOff = false,
): FillState {
  const st: FillState = {
    grid: emptyGrid(input),
    committed: {},
    satisfied: {},
    lotteryRank: buildLotteryRanks(input),
    timings: input.collectTimings ? {} : undefined,
  }
  for (const e of input.employees) {
    st.committed[e.id] = []
    st.satisfied[e.id] = 0
  }
  const metas = metaMap(input)
  // MUST-ACCEPT FIRST: honor every feasible requested shift of must-accept
  // employees before any other reservation, so their requests win all contention.
  timed(st, 'must-accept', () => mustAcceptRound(input, st, metas))
  // HYBRID: honor every feasible requested shift (request-first precedence),
  // resolving only request-vs-request contention; minimums are pursued next.
  timed(st, 'requests', () => honorRequestsRound(input, st, metas))
  // CROSS-WEEK FAIRNESS: reserve toward minShifts for carry-over (under-served
  // last published week) employees, before general fill. Top-precedence-gated &
  // open-slot-only ⇒ coverage-preserving; off-requests remain hard.
  timed(st, 'carry-over', () => carryOverRound(input, st, metas))
  // FIX 2: general max-matching fill of all remaining required slots.
  timed(st, 'general-fill', () => generalFill(input, st, metas))
  // NIGHT CAP: same-day swaps pull anyone over their night cap (≤3, unless
  // night/evening-only or they requested the nights) back down. Coverage- and
  // request-preserving. Runs before diversity so the type/co-worker pass then
  // re-optimises around the final night distribution.
  if (!skipDiversity) {
    timed(st, 'night-unload', () =>
      runNightUnloadPass(input, st, metas, buildNightThresholds(input)),
    )
  }
  // FAIRNESS dims 2 & 4: coverage-preserving diversity swaps (shift-type variety
  // + co-worker rotation). Swaps only — coverage & per-employee load unchanged.
  // `skipDiversity` (test-only) lets suites measure the pre-pass baseline.
  if (!skipDiversity) {
    timed(st, 'diversity', () => {
      runDiversityPass(input, st, metas)
      // The pass may move occupants onto/off requested cells; recompute satisfied
      // counts from the final committed state so stats stay accurate. (The pass
      // never lowers any employee's satisfied count — gated in request-gate.)
      for (const e of input.employees) {
        st.satisfied[e.id] = recountSatisfied(input, e.id, st.committed[e.id])
      }
    })
    // SENIOR ROLE: give senior-for-role workers their role within a shift via
    // coverage-neutral same-shift swaps (a role swap keeps the same shifts, so
    // satisfied counts are unchanged — no recount needed).
    timed(st, 'senior-swaps', () => runSeniorRolePass(input, st, metas))
    // MANAGER BALANCE: give every manager-holder ≥50% of their shifts in the
    // manager role via the same coverage-neutral same-shift role swaps (senior
    // managers protected). Same-shift ⇒ satisfied counts unchanged (no recount).
    timed(st, 'manager-balance', () => runManagerBalancePass(input, st, metas))
    // NIGHT CAP (re-enforce): the diversity pass optimises rest quality in the
    // same cost tier as the SOFT night cap, so it can trade the cap away and push
    // a worker to a 4th night. Run night-unload AGAIN after the swap block to pull
    // any such worker back to ≤ their threshold via coverage-preserving same-day
    // swaps. (Senior/manager swaps are night-neutral; only diversity can violate.)
    timed(st, 'night-unload-2', () =>
      runNightUnloadPass(input, st, metas, buildNightThresholds(input)),
    )
  }
  // NIGHT→OFF (hard rule): keep a night worker working the next day (coverage-
  // neutral displacement) rather than leaving them off, unless they requested
  // off. It deliberately trades some rest for night-worker continuity, so
  // `skipNightThenOff` lets the rest-quality test isolate the diversity pass.
  if (!skipNightThenOff) {
    timed(st, 'night-then-off', () => {
      runNightThenOffPass(input, st, metas)
      for (const e of input.employees) {
        st.satisfied[e.id] = recountSatisfied(input, e.id, st.committed[e.id])
      }
    })
  }
  // COVERAGE-RESCUE FIRST: fill remaining gaps with normal 8h shifts by reclaiming
  // the lowest-priority soft-off workers (vacation/רענון untouched; a senior's
  // off-request is honored over a junior's — see coverage-rescue). Doing this
  // BEFORE the 12h pass means a gap is patched with one 8h person rather than a
  // LONE m12_day (07–19) that would leave 19:00→night thin with no m12_night
  // partner. Records the overrides so the manager can be alerted.
  timed(st, 'coverage-rescue', () => {
    st.overriddenOff = runCoverageRescue(input, st, metas)
  })
  // LAST RESORT: 12h auto-coverage for any slot the 8h fill + rescue still can't
  // staff (a genuine shortage). day/night pair preferred, 03-15/15-03 last.
  timed(st, 'twelve-fill', () => {
    st.twelve = skipTwelve ? [] : runTwelveFill(input, st)
    if (!skipTwelve) {
      // A 12h COVERS requested base windows (e.g. m12_night satisfies a noon or
      // night request) — recount so stats.requestsSatisfied reflects it.
      for (const e of input.employees) {
        st.satisfied[e.id] = recountSatisfied(input, e.id, st.committed[e.id])
      }
    }
  })
  return st
}

/** Total filled slots in a committed FillState (sum of committed assignments). */
export function countFilled(st: FillState): number {
  let n = 0
  for (const id of Object.keys(st.committed)) n += st.committed[id].length
  return n
}
