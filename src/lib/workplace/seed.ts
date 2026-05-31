import {
  ROLES,
  ROLE_META,
  SHIFT_META,
  SHIFT_ORDER,
  FALLBACK_12H_ORDER,
  DEFAULT_REQUIREMENTS,
} from '@/lib/domain/constants'
import type { RoleName } from '@/lib/domain/constants'

export interface SeedRole {
  name: RoleName
  color: string
}

export interface SeedShiftType {
  key: string
  name: string
  start_hour: number
  hours: number
  color: string
  is_fallback: boolean
  sort: number
}

export interface SeedSettings {
  min_rest_hours: number
  ideal_rest_hours: number
  allow_12h_fallback: boolean
}

export interface SeedRequirement {
  day_of_week: number
  shiftKey: string
  roleName: RoleName
  count: number
}

export interface Seed {
  roles: SeedRole[]
  shiftTypes: SeedShiftType[]
  settings: SeedSettings
  requirements: SeedRequirement[]
}

export function buildSeed(): Seed {
  // Roles
  const roles: SeedRole[] = ROLES.map(name => ({
    name,
    color: ROLE_META[name].color,
  }))

  // Shift types: base shifts first, then fallback
  const allKeys = [...SHIFT_ORDER, ...FALLBACK_12H_ORDER]
  const shiftTypes: SeedShiftType[] = allKeys.map((key, sort) => {
    const meta = SHIFT_META[key]
    return {
      key,
      name: meta.name,
      start_hour: meta.start,
      hours: meta.hours,
      color: meta.color,
      is_fallback: meta.isFallback,
      sort,
    }
  })

  // Settings
  const settings: SeedSettings = {
    min_rest_hours: 8,
    ideal_rest_hours: 16,
    allow_12h_fallback: true,
  }

  // Requirements: 7 days × base shifts × roles with count > 0
  type BaseShiftKey = 'morning' | 'noon' | 'night'
  const BASE_SHIFT_ORDER: BaseShiftKey[] = ['morning', 'noon', 'night']
  const requirements: SeedRequirement[] = []
  for (let day_of_week = 0; day_of_week <= 6; day_of_week++) {
    for (const shiftKey of BASE_SHIFT_ORDER) {
      const roleMap = DEFAULT_REQUIREMENTS[shiftKey]
      for (const [roleName, count] of Object.entries(roleMap) as [RoleName, number][]) {
        if (count > 0) {
          requirements.push({ day_of_week, shiftKey, roleName, count })
        }
      }
    }
  }

  return { roles, shiftTypes, settings, requirements }
}
