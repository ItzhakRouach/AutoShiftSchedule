// Slots the manager marked as intentionally empty (see the `slot_marks` table)
// are a deliberate decision, not a coverage gap — the dashboard subtracts their
// headcount from the week's required total before computing uncovered slots.
import { coveredKeysOf } from './aggregate-index'

export interface RequirementRow {
  day_of_week: number
  shift_type_id: string
  role_id: string | null
  count: number
}

export interface SlotMarkRow {
  day_of_week: number
  shift_type_id: string
  role_id: string
}

/** Any assignment row — only its slot coordinates matter here. */
export interface SlotRef {
  day_of_week: number
  shift_type_id: string
  role_id: string | null
}

/**
 * Total required headcount waived by `marks`. Requirements are stored per
 * (day, shift type, role), so several rows may share a slot key — every one of
 * them is waived. A mark on a slot with no requirement contributes nothing.
 *
 * The waiver holds only while the slot is genuinely empty: a marked slot that
 * someone was later placed into is live again, and counting it as waived while
 * its assignment still counts as filled would understate the real gap. Pass the
 * period's occupied slots — run the assignments through `occupiedSlotRefs`
 * first so a slot covered by a 12h shift counts as occupied too.
 */
/**
 * The slots an assignment list actually occupies, expanded through 12h
 * coverage: a 07–19 row occupies both the morning and the noon slot, so a mark
 * on either of them is no longer in effect. Without this expansion the
 * dashboard would waive a slot the schedule page correctly reports as covered.
 * Rows whose shift type is unknown are dropped.
 */
export function occupiedSlotRefs(
  assignments: SlotRef[],
  keyById: Map<string, string>,
  idByKey: Map<string, string>,
): SlotRef[] {
  const refs: SlotRef[] = []
  for (const a of assignments) {
    for (const key of coveredKeysOf(keyById.get(a.shift_type_id))) {
      const baseId = idByKey.get(key)
      if (baseId) refs.push({ day_of_week: a.day_of_week, shift_type_id: baseId, role_id: a.role_id })
    }
  }
  return refs
}

export function markedRequiredCount(
  requirements: RequirementRow[],
  marks: SlotMarkRow[],
  assignments: SlotRef[] = [],
): number {
  if (marks.length === 0) return 0
  const occupied = new Set(assignments.map((a) => `${a.day_of_week}:${a.shift_type_id}:${a.role_id}`))
  const marked = new Set(
    marks
      .map((m) => `${m.day_of_week}:${m.shift_type_id}:${m.role_id}`)
      .filter((key) => !occupied.has(key)),
  )
  if (marked.size === 0) return 0
  let waived = 0
  for (const r of requirements) {
    if (marked.has(`${r.day_of_week}:${r.shift_type_id}:${r.role_id}`)) waived += r.count
  }
  return waived
}
