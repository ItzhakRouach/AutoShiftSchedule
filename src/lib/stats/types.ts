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

  // Requests
  requestHonoredPct: number | null   // % of non-off requests honored, null = no requests

  // Secondary
  activeEmployees: number
  totalHours: number
}

export interface EmployeeStat {
  id: string
  name: string
  color: string
  shifts: number
  hours: number
}

export interface RoleStat {
  id: string
  name: string
  color: string
  count: number
}

export interface FairnessStat {
  id: string
  name: string
  nightShifts: number
  weekendShifts: number
  requestHonoredPct: number | null // null = no requests
}

export interface DashboardStats {
  kpis: PeriodKPIs
  employees: EmployeeStat[]
  roles: RoleStat[]
  fairness: FairnessStat[]
}
