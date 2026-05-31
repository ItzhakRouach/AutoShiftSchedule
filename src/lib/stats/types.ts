export type Scope = 'week' | 'month' | 'year'

export interface KPIs {
  activeEmployees: number
  totalShifts: number
  totalHours: number
  coveragePct: number | null // null = no published period yet
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
  kpis: KPIs
  employees: EmployeeStat[]
  roles: RoleStat[]
  fairness: FairnessStat[]
}
