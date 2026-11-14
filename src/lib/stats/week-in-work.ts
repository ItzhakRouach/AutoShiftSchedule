/**
 * "The week in work" for the manager's home: how far the week being edited is
 * from publishable, and how the request collection for it is going. Pure — the
 * loader in week-in-work-data.ts feeds it rows.
 *
 * Open cells are counted by `countUncoveredCells`, the same function behind the
 * schedule page's live gaps badge, so the two can never disagree.
 */
import { splitAssignments, mapSlotMarks, type AssignmentRaw, type SlotMarkRaw } from '@/lib/schedule/view-data-grid'
import { countUncoveredCells } from '@/lib/schedule/week-table-data'
import { deadlineLabel, isPastDeadline } from '@/lib/deadline/compute'
import type { ScheduleView, ViewReq } from '@/lib/schedule/view-types'

export interface WeekInWorkInput {
  weekStart: string
  shiftTypes: { id: string; key: string; is_fallback: boolean | null }[]
  requirements: { day_of_week: number; shift_type_id: string; role_id: string; count: number }[]
  assignments: AssignmentRaw[]
  slotMarks: SlotMarkRaw[]
  /** One entry per request row; only the employee matters here. */
  requests: { employee_id: string }[]
  employees: { id: string; name: string }[]
  deadline: { dow: number; time: string; zone: string } | null
  nowMs: number
}

export interface WeekInWork {
  weekStart: string
  /** Required (day, shift, role) cells in the week. */
  totalCells: number
  /** Of those, how many still lack people (intentionally-empty cells excluded). */
  openCells: number
  hasAssignments: boolean
  twelveCount: number
  rosterCount: number
  submittedCount: number
  /** Names of employees with no request row yet, roster order. */
  notSubmitted: string[]
  deadline: { label: string; passed: boolean } | null
}

export function summarizeWeekInWork(input: WeekInWorkInput): WeekInWork {
  const idToKey: Record<string, string> = {}
  const fallbackIds = new Set<string>()
  for (const st of input.shiftTypes) {
    idToKey[st.id] = st.key
    if (st.is_fallback) fallbackIds.add(st.id)
  }

  const requirements: ViewReq = {}
  let totalCells = 0
  for (const r of input.requirements) {
    const key = idToKey[r.shift_type_id]
    if (!key || r.count <= 0) continue
    const byShift = ((requirements[r.day_of_week] ??= {})[key] ??= {})
    if (byShift[r.role_id] === undefined) totalCells++
    byShift[r.role_id] = (byShift[r.role_id] ?? 0) + r.count
  }

  const { grid, twelve, temps } = splitAssignments(input.assignments, idToKey)
  // Only the fields countUncoveredCells reads carry real data; the rest are inert.
  const view: ScheduleView = {
    periodId: '', status: '', weekStart: input.weekStart, days: [],
    shiftKeys: ['morning', 'noon', 'night'], roles: [], employees: [],
    requirements, grid, twelve, temps,
    slotMarks: mapSlotMarks(input.slotMarks, idToKey),
    shiftTypeIdByKey: {}, hasAssignments: input.assignments.length > 0,
    feasibility: null, requests: [], requestedSet: new Set(),
  }

  const submitted = new Set(input.requests.map((r) => r.employee_id))
  const d = input.deadline
  return {
    weekStart: input.weekStart,
    totalCells,
    openCells: countUncoveredCells(view),
    hasAssignments: input.assignments.length > 0,
    twelveCount: input.assignments.filter((a) => fallbackIds.has(a.shift_type_id)).length,
    rosterCount: input.employees.length,
    submittedCount: input.employees.filter((e) => submitted.has(e.id)).length,
    notSubmitted: input.employees.filter((e) => !submitted.has(e.id)).map((e) => e.name),
    deadline: d
      ? { label: deadlineLabel(input.weekStart, d.dow, d.time, d.zone), passed: isPastDeadline(new Date(input.nowMs), input.weekStart, d.dow, d.time, d.zone) }
      : null,
  }
}
