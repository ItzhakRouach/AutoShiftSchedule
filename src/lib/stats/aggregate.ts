import type { KPIs, EmployeeStat, RoleStat, FairnessStat } from './types'

interface AssignmentRow {
  employee_id: string
  day_of_week: number
  shift_type_id: string
  role_id: string | null
  hours: number // joined from shift_types
  is_fallback: boolean
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

export function aggregateKPIs(
  assignments: AssignmentRow[],
  employees: EmployeeRow[],
  requirementSummary: RequirementCount | null,
): KPIs {
  const totalShifts = assignments.length
  const totalHours = assignments.reduce((s, a) => s + (a.hours ?? 0), 0)
  const coveragePct =
    requirementSummary && requirementSummary.required > 0
      ? Math.round((requirementSummary.filled / requirementSummary.required) * 100)
      : null

  return {
    activeEmployees: employees.length,
    totalShifts,
    totalHours,
    coveragePct,
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

// night shift: start hour 23 or 19 (is_fallback night)
const NIGHT_SHIFT_KEYS = new Set(['night', 'm12_night'])

export function aggregateFairness(
  assignments: AssignmentRow[],
  requests: RequestRow[],
  employees: EmployeeRow[],
  shiftKeyById: Map<string, string>, // shift_type_id → key
): FairnessStat[] {
  return employees.map((e) => {
    const empAssignments = assignments.filter((a) => a.employee_id === e.id)
    const nightShifts = empAssignments.filter((a) =>
      NIGHT_SHIFT_KEYS.has(shiftKeyById.get(a.shift_type_id) ?? ''),
    ).length
    const weekendShifts = empAssignments.filter(
      (a) => a.day_of_week === 5 || a.day_of_week === 6,
    ).length

    // Request honored pct
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
