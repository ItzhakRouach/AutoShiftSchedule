export type Scope = 'week' | 'month' | 'year'

export type CoverageColor = 'green' | 'amber' | 'red'

export interface PeriodKPIs {
  // Coverage
  coveragePct: number | null   // filled/required %, null = no period
  coverageColor: CoverageColor
  filledSlots: number
  requiredSlots: number

  // Gaps / strain
  uncoveredSlots: number       // required − filled (act-on items)
  shifts12h: number            // 12h fallback shifts used
  belowMinCount: number        // employees with shifts < min_shifts_per_week

  // Requests — employees with ≥2 honored requests
  twoRequestsHonoredCount: number  // employees who received ≥2 of their requested shifts
  twoRequestsHonoredTotal: number  // total employees considered (with ≥1 non-off request)

  // Secondary
  activeEmployees: number
}

export interface EmployeeStat {
  id: string
  name: string
  color: string
  shifts: number
  hours: number
}

export interface FairnessStat {
  id: string
  name: string
  nightShifts: number
  weekendShifts: number
  /** count of non-off requested shifts with preferred_shift_ids for the period */
  requestedCount: number
  /** count of assignments that matched a requested shift (day + shift type) */
  honoredCount: number
}

export interface DashboardStats {
  kpis: PeriodKPIs
  employees: EmployeeStat[]
  fairness: FairnessStat[]
}
