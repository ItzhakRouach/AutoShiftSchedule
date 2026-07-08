// PURE gap diagnosis — turns an empty required slot into a human cause + a list
// of workers the manager could place or ask. Reuses the hard-constraint
// predicates so the diagnosis can never disagree with what the engine allows.
import type {
  Assignment,
  DayMeta,
  EngineInput,
  GapAskCandidate,
  GapReason,
  Grid,
  ShiftKey,
} from './types'
import { BASE_SHIFTS } from './types'
import {
  availabilityAllows,
  isAssignable,
  underMax,
  worksThatDay,
  type CheckContext,
} from './constraints'
import { isSacredBlocked } from './shabbat-holiday'

const NO_REQUEST = { off: false, preferred: [] as ShiftKey[] }
const MAX_ASK = 4

/** Reconstruct each employee's committed assignments from the grid. */
export function committedByEmpFromGrid(grid: Grid): Map<string, Assignment[]> {
  const byEmp = new Map<string, Assignment[]>()
  for (const [dayStr, byShift] of Object.entries(grid)) {
    const day = Number(dayStr)
    for (const shift of BASE_SHIFTS) {
      const byRole = byShift[shift] ?? {}
      for (const [roleId, ids] of Object.entries(byRole)) {
        for (const employeeId of ids) {
          const list = byEmp.get(employeeId) ?? byEmp.set(employeeId, []).get(employeeId)!
          list.push({ employeeId, day, shift, roleId })
        }
      }
    }
  }
  return byEmp
}

function ctxFor(input: EngineInput, meta: DayMeta, shift: ShiftKey, roleId: string, emp: EngineInput['employees'][number], committed: Assignment[]): CheckContext {
  return {
    emp, meta, shift, roleId,
    request: input.requests[emp.id]?.[meta.index] ?? NO_REQUEST,
    current: committed,
    settings: input.settings,
    priorTail: input.priorWeekTail?.[emp.id],
    nextHead: input.nextWeekHead?.[emp.id],
  }
}

/** First failing hard constraint for a candidate already known to be un-assignable
 *  even with a soft-off waiver — i.e. the reason asking them wouldn't help. */
function hardReason(ctx: CheckContext): GapReason {
  const { request: req, shift, meta, emp, current } = ctx
  if (req.off && !req.preferred.includes(shift) && req.offHard) return 'off'
  if (!availabilityAllows(emp, meta.index, shift)) return 'availability'
  if (isSacredBlocked(emp, meta, shift)) return 'sacred'
  if (worksThatDay(current, meta.index)) return 'assigned_elsewhere'
  if (!underMax(emp, current)) return 'at_max'
  return 'rest'
}

/** Diagnose one uncovered (day, shift, roleId) slot. */
export function diagnoseGap(
  input: EngineInput,
  committedByEmp: Map<string, Assignment[]>,
  day: number,
  shift: ShiftKey,
  roleId: string,
): { reason: GapReason; askCandidates: GapAskCandidate[] } {
  const meta = input.days.find((d) => d.index === day) ?? { index: day, isHolidayEve: false, isHoliday: false }
  const holders = input.employees.filter((e) => e.roleIds.includes(roleId))
  if (holders.length === 0) return { reason: 'no_role', askCandidates: [] }

  const asks: GapAskCandidate[] = []
  const hardReasons: GapReason[] = []
  for (const emp of holders) {
    const ctx = ctxFor(input, meta, shift, roleId, emp, committedByEmp.get(emp.id) ?? [])
    if (isAssignable(ctx)) asks.push({ employeeId: emp.id, reason: 'available' })
    else if (isAssignable(ctx, { allowSoftOff: true })) asks.push({ employeeId: emp.id, reason: 'soft_off' })
    else hardReasons.push(hardReason(ctx))
  }

  const askCandidates = asks.slice(0, MAX_ASK)
  if (asks.some((a) => a.reason === 'available')) return { reason: 'available', askCandidates }
  if (asks.some((a) => a.reason === 'soft_off')) return { reason: 'off', askCandidates }
  const unique = [...new Set(hardReasons)]
  return { reason: unique.length === 1 ? unique[0] : 'mixed', askCandidates: [] }
}
