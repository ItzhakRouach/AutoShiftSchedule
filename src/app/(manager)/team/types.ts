import type { EmploymentType, AvailabilityItem } from '@/lib/validation/employee'

export interface RoleOption {
  id: string
  name: string
  color: string
  rank: number
}

/** Manager-side view of one employee row (what /team lists and edits). */
export interface EmployeeData {
  id: string
  name: string
  phone: string | null
  color: string
  minShifts: number
  maxShifts: number | null
  employmentType: EmploymentType
  observesShabbat: boolean
  observesHolidays: boolean
  mustAccept: boolean
  /** Exempt from the workplace's weekly request-day cap. */
  unlimitedRequests: boolean
  roleIds: string[]
  seniorRoleIds?: string[]
  status: string
  availability: AvailabilityItem[] | null
}
