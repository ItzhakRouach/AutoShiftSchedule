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

interface Slot {
  day: number
  shift: ShiftKey
  roleId: string
}

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
 * Greedy estimate of how many required 8h slots can be staffed under hard
 * constraints alone (an upper-bound-ish feasibility probe; deterministic).
 */
export function maxStaffableSlots(input: EngineInput): number {
  const slots = expandSlots(input)
  const committed: Record<string, Assignment[]> = {}
  for (const e of input.employees) committed[e.id] = []
  let filled = 0
  for (const slot of slots) {
    const metaByIndex = input.days.find((d) => d.index === slot.day)!
    const winner = input.employees.find((emp) =>
      isAssignable({
        emp,
        meta: metaByIndex,
        shift: slot.shift,
        roleId: slot.roleId,
        request: input.requests[emp.id]?.[slot.day] ?? { off: false, preferred: [] },
        current: committed[emp.id],
        settings: input.settings,
      }),
    )
    if (winner) {
      committed[winner.id].push({
        employeeId: winner.id,
        day: slot.day,
        shift: slot.shift,
        roleId: slot.roleId,
      })
      filled++
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
