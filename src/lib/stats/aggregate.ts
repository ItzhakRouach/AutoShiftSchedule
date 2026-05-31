import type { PeriodKPIs, EmployeeStat, RoleStat, FairnessStat, CoverageColor } from './types'

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

interface RoleRow {
  id: string
  name: string
  color: string
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

export function aggregateKPIs(
  periodAssignments: AssignmentRow[],   // assignments for the CURRENT period
  allAssignments: AssignmentRow[],      // assignments for the scope (for hours total)
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

  // Request honored % across all employees with non-off requests
  const nonOffRequests = requests.filter(
    (r) => !r.is_off && r.preferred_shift_ids && r.preferred_shift_ids.length > 0,
  )
  let honored = 0
  for (const req of nonOffRequests) {
    const matched = periodAssignments.some(
      (a) =>
        a.employee_id === req.employee_id &&
        req.preferred_shift_ids!.includes(a.shift_type_id) &&
        a.day_of_week === req.day_of_week,
    )
    if (matched) honored++
  }
  const requestHonoredPct =
    nonOffRequests.length > 0
      ? Math.round((honored / nonOffRequests.length) * 100)
      : null

  const totalHours = allAssignments.reduce((s, a) => s + (a.hours ?? 0), 0)

  return {
    coveragePct,
    coverageColor: coverageColor(coveragePct),
    filledSlots: filled,
    requiredSlots: required,
    uncoveredSlots,
    shifts12h,
    belowMinCount,
    requestHonoredPct,
    activeEmployees: employees.length,
    totalHours,
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

export function aggregateRoles(assignments: AssignmentRow[], roles: RoleRow[]): RoleStat[] {
  const map = new Map<string, number>()
  for (const a of assignments) {
    if (a.role_id) map.set(a.role_id, (map.get(a.role_id) ?? 0) + 1)
  }
  return roles
    .map((r) => ({ id: r.id, name: r.name, color: r.color, count: map.get(r.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
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
    let honored = 0
    let total = 0
    for (const req of empRequests) {
      if (!req.preferred_shift_ids || req.preferred_shift_ids.length === 0) continue
      total += 1
      const matched = empAssignments.some(
        (a) =>
          req.preferred_shift_ids!.includes(a.shift_type_id) &&
          a.day_of_week === req.day_of_week,
      )
      if (matched) honored += 1
    }
    const requestHonoredPct = total > 0 ? Math.round((honored / total) * 100) : null

    return { id: e.id, name: e.name, nightShifts, weekendShifts, requestHonoredPct }
  })
}
