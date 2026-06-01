// Grid construction, requirement iteration, warnings & coverage. Pure helpers.
import { ROLES, SHIFT_META } from '@/lib/domain/constants'
import {
  BASE_SHIFTS,
  type Assignment,
  type Coverage,
  type Employee,
  type EngineInput,
  type EngineResult,
  type Grid,
  type ShiftKey,
  type Warning,
} from './types'

export function emptyGrid(input: EngineInput): Grid {
  const grid: Grid = {}
  for (const meta of input.days) {
    grid[meta.index] = {} as Record<ShiftKey, Record<string, string[]>>
    for (const shift of BASE_SHIFTS) {
      grid[meta.index][shift] = {}
      for (const role of ROLES) grid[meta.index][shift][role] = []
    }
  }
  return grid
}

/** Iterate every (day, shift, roleId, need) required slot in the week. */
export function forEachRequirement(
  input: EngineInput,
  fn: (day: number, shift: ShiftKey, roleId: string, need: number) => void,
): void {
  for (const meta of input.days) {
    const dayReq = input.requirements[meta.index]
    if (!dayReq) continue
    for (const shift of BASE_SHIFTS) {
      const roleReq = dayReq[shift]
      if (!roleReq) continue
      for (const roleId of Object.keys(roleReq)) {
        fn(meta.index, shift, roleId, roleReq[roleId])
      }
    }
  }
}

export function collectWarnings(input: EngineInput, grid: Grid): Warning[] {
  const warnings: Warning[] = []
  forEachRequirement(input, (day, shift, roleId, need) => {
    const have = grid[day][shift][roleId].length
    if (have < need) warnings.push({ day, shift, roleId, missing: need - have })
  })
  return warnings
}

export function computeCoverage(required: number, warnings: Warning[]): Coverage {
  const filled = required - warnings.reduce((s, w) => s + w.missing, 0)
  return {
    requiredSlots: required,
    filledSlots: filled,
    percent: required === 0 ? 100 : Math.round((filled / required) * 100),
  }
}

export function computeStats(
  employees: Employee[],
  committed: Record<string, Assignment[]>,
  satisfied: Record<string, number>,
): EngineResult['stats'] {
  const stats: EngineResult['stats'] = {}
  for (const e of employees) {
    const list = committed[e.id]
    const byType = { morning: 0, noon: 0, night: 0 }
    for (const a of list) byType[a.shift]++
    stats[e.id] = {
      employeeId: e.id,
      shifts: list.length,
      hours: list.reduce((s, a) => s + SHIFT_META[a.shift].hours, 0),
      belowMin: list.length < e.minShifts,
      requestsSatisfied: satisfied[e.id],
      assignments: list,
      byType,
    }
  }
  return stats
}
