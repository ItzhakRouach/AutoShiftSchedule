// Coverage-rescue pass (last resort). After the normal 8h fill + 12h fallback,
// some required slots can remain uncovered because too many workers REQUESTED
// off that day. Worker off-requests are SOFT (offHard=false): when a day would
// otherwise be impossible to staff, we reclaim the fewest, lowest-priority
// soft-off workers to fill the gaps — never touching a vacation/רענון
// (offHard=true), and always honoring every other hard constraint (role, rest,
// Shabbat, one-shift/day, maxShifts) via isAssignable({ allowSoftOff: true }).
// PRIORITY: a SENIOR worker's off-request is honored first — we override the
// non-senior (lower-priority) holders before ever pulling in a senior; a senior
// is reclaimed only if no non-senior can cover the slot. Each override is
// recorded so the manager can be told who was pulled in.
import type { DayMeta, DayRequest, EngineInput, OverriddenOff } from './types'
import type { FillState } from './dayfill'
import { openSlotsForDay } from './dayfill'
import { isAssignable } from './constraints'
import { isSeniorForRole } from './scoring'

export type { OverriddenOff } from './types'

function reqOf(input: EngineInput, empId: string, day: number): DayRequest {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

/**
 * Fill still-uncovered required slots by overriding the lowest-priority SOFT
 * off-requests. Mutates `st`; returns the list of overrides. Deterministic
 * (candidates ordered by current load, then lottery rank).
 */
export function runCoverageRescue(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): OverriddenOff[] {
  const overrides: OverriddenOff[] = []

  for (const d of input.days) {
    const meta = metas[d.index]
    // Each entry is one still-needed unit (requirement − already-filled, incl 12h).
    for (const slot of openSlotsForDay(input, st, d.index)) {
      const candidates = input.employees
        .filter((e) => {
          const req = reqOf(input, e.id, d.index)
          if (!req.off || req.offHard) return false // only overridable soft-off
          return isAssignable(
            {
              emp: e,
              meta,
              shift: slot.shift,
              roleId: slot.roleId,
              request: req,
              current: st.committed[e.id],
              settings: input.settings,
              priorTail: input.priorWeekTail?.[e.id],
            },
            { allowSoftOff: true },
          )
        })
        // Override the lowest-priority, least-disruptive worker first:
        //  1) NON-senior before senior (a senior's off-request is honored unless
        //     no one else can cover — see header).
        //  2) fewest shifts so far (balance the load).
        //  3) deterministic lottery tie-break.
        .sort(
          (a, b) =>
            (isSeniorForRole(a, slot.roleId) ? 1 : 0) - (isSeniorForRole(b, slot.roleId) ? 1 : 0) ||
            st.committed[a.id].length - st.committed[b.id].length ||
            st.lotteryRank[a.id] - st.lotteryRank[b.id],
        )

      const pick = candidates[0]
      if (!pick) continue // genuinely impossible — left for the feasibility alert

      st.grid[slot.day][slot.shift][slot.roleId].push(pick.id)
      st.committed[pick.id].push({
        employeeId: pick.id,
        day: slot.day,
        shift: slot.shift,
        roleId: slot.roleId,
      })
      overrides.push({ employeeId: pick.id, day: slot.day, shift: slot.shift, roleId: slot.roleId })
    }
  }

  return overrides
}
