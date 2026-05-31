// Bipartite maximum matching (Kuhn's augmenting-path algorithm), pure.
//
// Used both for per-day fill (FIX 2) and feasibility (FIX 3). The graph is
// (open role-slots) × (eligible employees). We drive the augmenting search by a
// caller-supplied employee priority order so that higher-priority employees are
// matched first (FIX 4) while still maximising the number of filled slots.
//
// Each employee has a per-round capacity (1 for a single day; up to 2 in the
// request-reservation pre-pass — FIX 5). Edges are supplied by `eligible`.

/** A concrete open slot to be filled. */
export interface MatchSlot {
  day: number
  shift: 'morning' | 'noon' | 'night'
  roleId: string
}

export interface MatchInput<E> {
  slots: MatchSlot[]
  /** Employees in PRIORITY order (highest priority first). */
  employees: E[]
  /** id accessor for an employee. */
  idOf: (e: E) => string
  /** per-employee capacity (max slots this employee may take this round). */
  capacityOf: (e: E) => number
  /** is this employee eligible for this slot, given already-chosen slots? */
  eligible: (e: E, slot: MatchSlot, chosenForEmp: MatchSlot[]) => boolean
}

export interface MatchResult {
  /** slotIndex -> employee id (only for matched slots). */
  assignment: Map<number, string>
  /** count of matched slots. */
  matched: number
}

/**
 * Maximise the number of matched slots. Employees are processed in priority
 * order; each tries to claim slots via augmenting paths. An employee may hold up
 * to `capacityOf` slots. Augmenting may bump a lower-priority employee off a slot
 * only if that employee can be re-routed to another eligible slot, never reducing
 * the total match (Kuhn's invariant) and never exceeding any capacity.
 */
export function maxMatch<E>(input: MatchInput<E>): MatchResult {
  const { slots, employees, idOf, capacityOf, eligible } = input
  // slot -> employee index currently holding it (-1 = free)
  const slotOwner = new Array<number>(slots.length).fill(-1)
  // employee index -> list of slot indices it currently holds
  const empSlots: number[][] = employees.map(() => [])

  const chosenSlotsFor = (ei: number): MatchSlot[] =>
    empSlots[ei].map((si) => slots[si])

  // Try to give employee `ei` one more slot via an augmenting path.
  const tryAugment = (ei: number, visitedSlots: boolean[]): boolean => {
    for (let si = 0; si < slots.length; si++) {
      if (visitedSlots[si]) continue
      const slot = slots[si]
      if (!eligible(employees[ei], slot, chosenSlotsFor(ei))) continue
      visitedSlots[si] = true
      const owner = slotOwner[si]
      if (owner === -1) {
        slotOwner[si] = ei
        empSlots[ei].push(si)
        return true
      }
      // Slot occupied: try to re-route its current owner to a different slot,
      // but only if the owner stays within capacity after losing this slot.
      const ownerRest = empSlots[owner].filter((s) => s !== si)
      // temporarily release the slot from the owner
      empSlots[owner] = ownerRest
      slotOwner[si] = -1
      if (tryAugment(owner, visitedSlots)) {
        slotOwner[si] = ei
        empSlots[ei].push(si)
        return true
      }
      // revert
      empSlots[owner].push(si)
      slotOwner[si] = owner
    }
    return false
  }

  for (let ei = 0; ei < employees.length; ei++) {
    const cap = capacityOf(employees[ei])
    for (let k = 0; k < cap; k++) {
      if (empSlots[ei].length >= cap) break
      const visited = new Array<boolean>(slots.length).fill(false)
      if (!tryAugment(ei, visited)) break
    }
  }

  const assignment = new Map<number, string>()
  let matched = 0
  for (let si = 0; si < slots.length; si++) {
    if (slotOwner[si] !== -1) {
      assignment.set(si, idOf(employees[slotOwner[si]]))
      matched++
    }
  }
  return { assignment, matched }
}
