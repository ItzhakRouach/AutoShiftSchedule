/**
 * Pure helpers for the mobile day view (DayGrid): per-role rows for one
 * (day, shift) section, sharing WeekTable's 12h semantics — the 12h worker's
 * chip appears in its anchor shift's role row, and covered-but-empty slots
 * count toward the requirement (rendered as a "12ש׳" marker, not "לא מאויש").
 */
import type { ScheduleView } from './view-data'
import type { CellEntry, WeekGrid } from './week-table-data'

export interface DayRoleRow {
  /** Base + 12h-anchor + temp entries for this (day, shift, role) cell. */
  entries: CellEntry[]
  /** 12h-covered slots without a chip — count toward the target. */
  covered: number
  assigned: number
  missing: number
  /** Base 8h roster ids only — what the slot editor (SwapEditor) operates on. */
  baseIds: string[]
}

export function buildDayRoleRow(
  view: ScheduleView,
  weekGrid: WeekGrid,
  coveredMap: Map<string, number>,
  selDay: number,
  shift: string,
  roleId: string,
): DayRoleRow {
  const entries = weekGrid[selDay]?.[shift]?.[roleId] ?? []
  const covered = coveredMap.get(`${selDay}:${shift}:${roleId}`) ?? 0
  const need = view.requirements[selDay]?.[shift]?.[roleId] ?? 0
  const assigned = entries.length + covered
  return {
    entries,
    covered,
    assigned,
    missing: Math.max(0, need - assigned),
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
): string[] {
  const req = view.requirements[selDay]?.[shift] ?? {}
  return view.roles
    .map((r) => r.id)
    .filter(
      (rid) =>
        (req[rid] ?? 0) > 0 ||
        (weekGrid[selDay]?.[shift]?.[rid]?.length ?? 0) > 0 ||
        (coveredMap.get(`${selDay}:${shift}:${rid}`) ?? 0) > 0,
    )
}
