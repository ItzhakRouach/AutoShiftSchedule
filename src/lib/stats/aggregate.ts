import type { PeriodKPIs, EmployeeStat, FairnessStat, CoverageColor } from './types'
import { groupRequestsByEmployee, indexAssignments, reqIsHonored } from './aggregate-index'

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
 * requested. An employee passes if count ≥ min(2, theirRequestCount).
 * O(R + A): one O(A) index pass, then O(1) lookup per request.
 */
export function computeTwoRequestsHonored(
  periodAssignments: AssignmentRow[],
  requests: RequestRow[],
  employees: EmployeeRow[],
): { count: number; total: number } {
  const index = indexAssignments(periodAssignments)
  const reqsByEmp = groupRequestsByEmployee(requests)

  let count = 0
  let total = 0
  for (const emp of employees) {
    const empReqs = reqsByEmp.get(emp.id) ?? []
    if (empReqs.length === 0) continue
    total += 1
    let honored = 0
    for (const req of empReqs) if (reqIsHonored(index, emp.id, req)) honored++
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

/**
 * Per-employee fairness rollup: night count, weekend count, and request honor
 * stats. O(A + R + E): single pass to bucket per-employee, then O(1) lookups
 * per request via the shared assignment index.
 */
export function aggregateFairness(
  assignments: AssignmentRow[],
  requests: RequestRow[],
  employees: EmployeeRow[],
  shiftKeyById: Map<string, string>,
): FairnessStat[] {
  const perEmp = new Map<string, { night: number; weekend: number; daysShifts: Set<string> }>()
  for (const e of employees) {
    perEmp.set(e.id, { night: 0, weekend: 0, daysShifts: new Set() })
  }
  for (const a of assignments) {
    const agg = perEmp.get(a.employee_id)
    if (!agg) continue
    if (NIGHT_SHIFT_KEYS.has(shiftKeyById.get(a.shift_type_id) ?? '')) agg.night += 1
    if (a.day_of_week === 5 || a.day_of_week === 6) agg.weekend += 1
    agg.daysShifts.add(`${a.day_of_week}:${a.shift_type_id}`)
  }

  const reqsByEmp = groupRequestsByEmployee(requests)
  return employees.map((e) => {
    const agg = perEmp.get(e.id)!
    const empReqs = reqsByEmp.get(e.id) ?? []
    let honoredCount = 0
    for (const req of empReqs) {
      if (req.is_off) {
        // Off-day honored = the employee did not work that day.
        let worksThatDay = false
        for (const k of agg.daysShifts) if (k.startsWith(`${req.day_of_week}:`)) { worksThatDay = true; break }
        if (!worksThatDay) honoredCount += 1
      } else if (req.preferred_shift_ids?.some((sid) => agg.daysShifts.has(`${req.day_of_week}:${sid}`))) {
        honoredCount += 1
      }
    }
    return {
      id: e.id, name: e.name,
      nightShifts: agg.night, weekendShifts: agg.weekend,
      requestedCount: empReqs.length, honoredCount,
    }
  })
}
