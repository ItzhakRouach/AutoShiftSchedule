import type { PeriodKPIs, EmployeeStat, FairnessStat, CoverageColor } from './types'

export interface AssignmentRow {
  employee_id: string
  day_of_week: number
  shift_type_id: string
  role_id: string | null
  hours: number         // joined from shift_types
  is_fallback: boolean  // true when shift_type hours === 12 (or key contains '12h')
}

interface RequestRow {
  employee_id: string
  period_id: string
  day_of_week: number
  is_off: boolean
  preferred_shift_ids: string[] | null
}

interface EmployeeRow {
  id: string
  name: string
  color: string
  min_shifts_per_week: number
}

interface RequirementCount {
  filled: number
  required: number
}

export function coverageColor(pct: number | null): CoverageColor {
  if (pct === null) return 'red'
  if (pct >= 100) return 'green'
  if (pct >= 80) return 'amber'
  return 'red'
}

/**
 * For each employee, count how many of their assignments fell on a shift they
 * requested (non-off, preferred_shift_ids includes the assigned shift_type_id,
 * same day_of_week). An employee "passes" if that count ≥ 2.
 *
 * Edge case: employees who have fewer than 2 non-off requests are counted in
 * `total` only if they have ≥1 such request; their threshold is
 * min(2, theirRequestCount), so an employee with exactly 1 request passes if
 * that 1 request was honored.
 */
export function computeTwoRequestsHonored(
  periodAssignments: AssignmentRow[],
  requests: RequestRow[],
  employees: EmployeeRow[],
): { count: number; total: number } {
  let count = 0
  let total = 0

  for (const emp of employees) {
    const empReqs = requests.filter(
      (r) =>
        r.employee_id === emp.id &&
        !r.is_off &&
        r.preferred_shift_ids &&
        r.preferred_shift_ids.length > 0,
    )
    if (empReqs.length === 0) continue
    total += 1

    let honored = 0
    for (const req of empReqs) {
      const matched = periodAssignments.some(
        (a) =>
          a.employee_id === emp.id &&
          a.day_of_week === req.day_of_week &&
          req.preferred_shift_ids!.includes(a.shift_type_id),
      )
      if (matched) honored++
    }

    const threshold = Math.min(2, empReqs.length)
    if (honored >= threshold) count++
  }

  return { count, total }
}

export function aggregateKPIs(
  periodAssignments: AssignmentRow[],
  employees: EmployeeRow[],
  requirementSummary: RequirementCount | null,
  requests: RequestRow[],
): PeriodKPIs {
  const filled = requirementSummary?.filled ?? 0
  const required = requirementSummary?.required ?? 0

  const coveragePct =
    required > 0 ? Math.round((filled / required) * 100) : null

  const uncoveredSlots = required > 0 ? Math.max(0, required - filled) : 0

  const shifts12h = periodAssignments.filter((a) => a.is_fallback).length

  // Employees with fewer period assignments than min_shifts_per_week
  const shiftsPerEmployee = new Map<string, number>()
  for (const a of periodAssignments) {
    shiftsPerEmployee.set(a.employee_id, (shiftsPerEmployee.get(a.employee_id) ?? 0) + 1)
  }
  const belowMinCount = employees.filter(
    (e) => (shiftsPerEmployee.get(e.id) ?? 0) < e.min_shifts_per_week,
  ).length

  const { count: twoRequestsHonoredCount, total: twoRequestsHonoredTotal } =
    computeTwoRequestsHonored(periodAssignments, requests, employees)

  return {
    coveragePct,
    coverageColor: coverageColor(coveragePct),
    filledSlots: filled,
    requiredSlots: required,
    uncoveredSlots,
    shifts12h,
    belowMinCount,
    twoRequestsHonoredCount,
    twoRequestsHonoredTotal,
    activeEmployees: employees.length,
  }
}

export function aggregateEmployees(
  assignments: AssignmentRow[],
  employees: EmployeeRow[],
): EmployeeStat[] {
  const map = new Map<string, { shifts: number; hours: number }>()
  for (const e of employees) map.set(e.id, { shifts: 0, hours: 0 })
  for (const a of assignments) {
    const cur = map.get(a.employee_id)
    if (cur) {
      cur.shifts += 1
      cur.hours += a.hours ?? 0
    }
  }
  return employees
    .map((e) => {
      const s = map.get(e.id) ?? { shifts: 0, hours: 0 }
      return { id: e.id, name: e.name, color: e.color, shifts: s.shifts, hours: s.hours }
    })
    .sort((a, b) => b.hours - a.hours)
}

const NIGHT_SHIFT_KEYS = new Set(['night', 'm12_night'])

export function aggregateFairness(
  assignments: AssignmentRow[],
  requests: RequestRow[],
  employees: EmployeeRow[],
  shiftKeyById: Map<string, string>,
): FairnessStat[] {
  return employees.map((e) => {
    const empAssignments = assignments.filter((a) => a.employee_id === e.id)
    const nightShifts = empAssignments.filter((a) =>
      NIGHT_SHIFT_KEYS.has(shiftKeyById.get(a.shift_type_id) ?? ''),
    ).length
    const weekendShifts = empAssignments.filter(
      (a) => a.day_of_week === 5 || a.day_of_week === 6,
    ).length

    const empRequests = requests.filter((r) => r.employee_id === e.id && !r.is_off)
    let honoredCount = 0
    let requestedCount = 0
    for (const req of empRequests) {
      if (!req.preferred_shift_ids || req.preferred_shift_ids.length === 0) continue
      requestedCount += 1
      const matched = empAssignments.some(
        (a) =>
          req.preferred_shift_ids!.includes(a.shift_type_id) &&
          a.day_of_week === req.day_of_week,
      )
      if (matched) honoredCount += 1
    }

    return { id: e.id, name: e.name, nightShifts, weekendShifts, requestedCount, honoredCount }
  })
}
