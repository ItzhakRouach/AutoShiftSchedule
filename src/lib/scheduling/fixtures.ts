// Hand-computed fixture builders for engine tests (test-only helpers).
import type {
  DayMeta,
  Employee,
  EmploymentType,
  EngineInput,
  Requirements,
  RequestMap,
  Settings,
  ShiftKey,
} from './types'

export const GUARD = 'מאבטח'
export const SHIFT_MGR = 'אחמ״ש'
export const DISPATCH = 'מוקדן'

export function emp(id: string, over: Partial<Employee> = {}): Employee {
  return {
    id,
    roleIds: [GUARD],
    employmentType: 'full',
    minShifts: 0,
    maxShifts: null,
    observesShabbat: false,
    observesHolidays: false,
    mustAccept: false,
    availability: null,
    ...over,
  }
}

/** Plain 7-day week, no holidays. */
export function plainWeek(over: Partial<DayMeta>[] = []): DayMeta[] {
  return Array.from({ length: 7 }, (_, index) => ({
    index,
    isHolidayEve: false,
    isHoliday: false,
    ...(over[index] ?? {}),
  }))
}

export function settings(over: Partial<Settings> = {}): Settings {
  return { minRestHours: 8, idealRestHours: 16, allow12hFallback: false, ...over }
}

/** Requirement of `count` of `role` for a single shift on the given days. */
export function reqFor(
  days: number[],
  shift: ShiftKey,
  role: string,
  count: number,
): Requirements {
  const out: Requirements = {}
  for (const d of days) {
    out[d] = out[d] ?? ({} as Requirements[number])
    out[d][shift] = out[d][shift] ?? {}
    out[d][shift][role] = count
  }
  return out
}

/** Merge several Requirements objects. */
export function mergeReqs(...parts: Requirements[]): Requirements {
  const out: Requirements = {}
  for (const p of parts) {
    for (const d of Object.keys(p).map(Number)) {
      out[d] = out[d] ?? ({} as Requirements[number])
      for (const sh of Object.keys(p[d]) as ShiftKey[]) {
        out[d][sh] = { ...(out[d][sh] ?? {}), ...p[d][sh] }
      }
    }
  }
  return out
}

export function buildRequests(
  employees: Employee[],
  per: (id: string, day: number) => { off?: boolean; offHard?: boolean; preferred?: ShiftKey[] } = () => ({}),
): RequestMap {
  const out: RequestMap = {}
  for (const e of employees) {
    out[e.id] = {}
    for (let d = 0; d < 7; d++) {
      const r = per(e.id, d)
      out[e.id][d] = { off: r.off ?? r.offHard ?? false, offHard: r.offHard ?? false, preferred: r.preferred ?? [] }
    }
  }
  return out
}

export function input(over: Partial<EngineInput> & { employees: Employee[] }): EngineInput {
  const employees = over.employees
  return {
    employees,
    days: over.days ?? plainWeek(),
    requests: over.requests ?? buildRequests(employees),
    requirements: over.requirements ?? {},
    settings: over.settings ?? settings(),
    seed: over.seed ?? 1,
    managerRoleId: over.managerRoleId,
    priorWeekTail: over.priorWeekTail,
    nextWeekHead: over.nextWeekHead,
    collectTimings: over.collectTimings,
    skipTwelve: over.skipTwelve,
  }
}

export const E: Record<string, EmploymentType> = {
  full: 'full',
  part: 'part',
  student: 'student',
}
