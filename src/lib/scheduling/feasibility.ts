// Feasibility pre-check: are there enough available employees to cover all
// required 8h slots, or are 12h shifts needed? Pure over the same inputs.
import {
  BASE_SHIFTS,
  type Assignment,
  type EngineInput,
  type FeasibilityResult,
  type ShiftKey,
} from './types'
import { isAssignable } from './constraints'
import { maxMatch, type MatchSlot } from './matching'

type Slot = MatchSlot

/** Count total required role-slots across the week. */
export function countRequiredSlots(input: EngineInput): number {
  let total = 0
  for (const meta of input.days) {
    const dayReq = (input.requirements[meta.index] ?? {}) as Record<ShiftKey, Record<string, number>>
    for (const shift of BASE_SHIFTS) {
      const roleReq = dayReq[shift]
      if (!roleReq) continue
      for (const roleId of Object.keys(roleReq)) total += roleReq[roleId]
    }
  }
  return total
}

function expandSlots(input: EngineInput): Slot[] {
  const slots: Slot[] = []
  for (const meta of input.days) {
    const dayReq = (input.requirements[meta.index] ?? {}) as Record<ShiftKey, Record<string, number>>
    for (const shift of BASE_SHIFTS) {
      const roleReq = dayReq[shift]
      if (!roleReq) continue
      for (const roleId of Object.keys(roleReq)) {
        for (let i = 0; i < roleReq[roleId]; i++) {
          slots.push({ day: meta.index, shift, roleId })
        }
      }
    }
  }
  return slots
}

/**
 * Maximum number of required 8h slots that can be staffed under hard constraints
 * (FIX 3). For each day we compute a bipartite MAX-matching (Kuhn) between that
 * day's required role-slots and eligible employees — capacity 1/day (one shift
 * per day) — committing the result so rest is honored against prior days. Days
 * are processed in order. This removes the first-fit false "short"/"needs12h".
 */
export function maxStaffableSlots(input: EngineInput): number {
  const committed: Record<string, Assignment[]> = {}
  for (const e of input.employees) committed[e.id] = []
  let filled = 0
  for (const meta of input.days) {
    const slots: Slot[] = expandSlots(input).filter((s) => s.day === meta.index)
    if (slots.length === 0) continue
    const res = maxMatch({
      slots,
      employees: input.employees,
      idOf: (e) => e.id,
      capacityOf: () => 1,
      eligible: (emp, slot) =>
        isAssignable({
          emp,
          meta,
          shift: slot.shift,
          roleId: slot.roleId,
          request: input.requests[emp.id]?.[slot.day] ?? { off: false, preferred: [] },
          current: committed[emp.id],
          settings: input.settings,
        }),
    })
    for (let si = 0; si < slots.length; si++) {
      const id = res.assignment.get(si)
      if (id != null) {
        committed[id].push({ employeeId: id, day: slots[si].day, shift: slots[si].shift, roleId: slots[si].roleId })
        filled++
      }
    }
  }
  return filled
}

/** Pure feasibility result over the same engine inputs. */
export function checkFeasibility(input: EngineInput): FeasibilityResult {
  const requiredSlots = countRequiredSlots(input)
  const maxStaffable = maxStaffableSlots(input)
  const shortBy = Math.max(0, requiredSlots - maxStaffable)
  if (shortBy === 0) {
    return {
      status: 'ok',
      requiredSlots,
      maxStaffable,
      shortBy: 0,
      details: 'All required 8h slots can be staffed.',
    }
  }
  const status = input.settings.allow12hFallback ? 'needs12h' : 'short'
  const details =
    status === 'needs12h'
      ? `Short by ${shortBy} 8h slot(s); 12h fallback shifts needed.`
      : `Short by ${shortBy} 8h slot(s); not enough available employees.`
  return { status, requiredSlots, maxStaffable, shortBy, details }
}
