/**
 * Pure helpers for the mobile day view (DayGrid): per-role rows for one
 * (day, shift) section, sharing WeekTable's 12h semantics — the 12h worker's
 * chip appears in its anchor shift's role row, and covered-but-empty slots
 * count toward the requirement (rendered as a "12ש׳" marker, not "לא מאויש").
 * Slots the manager marked as intentionally empty carry their caption instead
 * of a shortfall — pass the `buildSlotMarkMap` result as `marks`.
 */
import type { ScheduleView } from './view-data'
import { slotKey, type CellEntry, type WeekGrid } from './week-table-data'

export interface DayRoleRow {
  /** Base + 12h-anchor + temp entries for this (day, shift, role) cell. */
  entries: CellEntry[]
  /** 12h-covered slots without a chip — count toward the target. */
  covered: number
  assigned: number
  missing: number
  /** Base 8h roster ids only — what the slot editor (SwapEditor) operates on. */
  baseIds: string[]
  /** The mark's caption when the manager left this slot empty on purpose;
   *  undefined when unmarked. `''` means marked with no caption. */
  markLabel?: string
  /** The mark is IN EFFECT — marked and still empty. Every mark-aware bit of
   *  UI must key off this, never off `markLabel` alone: a marked slot that was
   *  later filled is a live slot again and must be tinted/scored as one. */
  waived: boolean
}

export function buildDayRoleRow(
  view: ScheduleView,
  weekGrid: WeekGrid,
  coveredMap: Map<string, number>,
  selDay: number,
  shift: string,
  roleId: string,
  marks?: Map<string, string>,
): DayRoleRow {
  const entries = weekGrid[selDay]?.[shift]?.[roleId] ?? []
  const covered = coveredMap.get(slotKey(selDay, shift, roleId)) ?? 0
  const need = view.requirements[selDay]?.[shift]?.[roleId] ?? 0
  const assigned = entries.length + covered
  // A marked slot is empty on purpose — it shows its caption, never a red
  // "לא מאויש" chip, so its shortfall is reported as zero. Once someone is
  // placed there the slot is live again and its shortfall counts as usual.
  const markLabel = marks?.get(slotKey(selDay, shift, roleId))
  const waived = markLabel !== undefined && assigned === 0
  return {
    entries,
    covered,
    assigned,
    missing: waived ? 0 : Math.max(0, need - assigned),
    markLabel,
    waived,
    baseIds: entries.filter((e) => !e.is12h && !e.tempName).map((e) => e.employeeId),
  }
}

/** Roles worth a row in this shift section: a staffing requirement, an actual
 *  entry, or 12h coverage. Ordered by view.roles (rank-desc). The covered check
 *  matters for the employee view, where requirements are empty (RLS) — a noon
 *  slot covered by a 07–19 shift must still surface its role row. */
export function dayRoleIds(
  view: ScheduleView,
  weekGrid: WeekGrid,
  coveredMap: Map<string, number>,
  selDay: number,
  shift: string,
  marks?: Map<string, string>,
): string[] {
  const req = view.requirements[selDay]?.[shift] ?? {}
  return view.roles
    .map((r) => r.id)
    .filter(
      (rid) =>
        (req[rid] ?? 0) > 0 ||
        (weekGrid[selDay]?.[shift]?.[rid]?.length ?? 0) > 0 ||
        (coveredMap.get(slotKey(selDay, shift, rid)) ?? 0) > 0 ||
        marks?.has(slotKey(selDay, shift, rid)) === true,
    )
}
