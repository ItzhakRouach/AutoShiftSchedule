import { describe, it, expect } from 'vitest'
import { expandRolesByRank } from './role-rank'
import { mapToEngineInput, weekDatesFrom, type MapInput } from './map-rows'

const RANKED_ROLES = [
  { id: 'r-ahmash', name: 'אחמ״ש', rank: 3 },
  { id: 'r-mokdan', name: 'מוקדן', rank: 2 },
  { id: 'r-mabtach', name: 'מאבטח', rank: 1 },
]

describe('expandRolesByRank', () => {
  it('אחמ״ש(3) → all three roles', () => {
    expect(new Set(expandRolesByRank(['r-ahmash'], RANKED_ROLES))).toEqual(
      new Set(['r-ahmash', 'r-mokdan', 'r-mabtach']),
    )
  })
  it('מוקדן(2) → מוקדן + מאבטח', () => {
    expect(new Set(expandRolesByRank(['r-mokdan'], RANKED_ROLES))).toEqual(
      new Set(['r-mokdan', 'r-mabtach']),
    )
  })
  it('מאבטח(1) → only מאבטח', () => {
    expect(expandRolesByRank(['r-mabtach'], RANKED_ROLES)).toEqual(['r-mabtach'])
  })
  it('multi-role uses the MAX rank held', () => {
    expect(new Set(expandRolesByRank(['r-mabtach', 'r-mokdan'], RANKED_ROLES))).toEqual(
      new Set(['r-mokdan', 'r-mabtach']),
    )
  })
  it('no roles held → empty', () => {
    expect(expandRolesByRank([], RANKED_ROLES)).toEqual([])
  })
  it('treats missing rank as 1', () => {
    const roles = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', rank: 2 }]
    expect(expandRolesByRank(['a'], roles)).toEqual(['a'])
  })
})

describe('mapToEngineInput applies rank-expansion (adapter)', () => {
  const rows: MapInput = {
    weekDates: weekDatesFrom('2026-06-07'),
    shiftTypes: [{ id: 'st-m', key: 'morning' }],
    roles: RANKED_ROLES,
    employees: [{
      id: 'e1', employment_type: 'full', min_shifts_per_week: 0,
      max_shifts_per_week: null, observes_shabbat: false, observes_holidays: false, must_accept: false,
    }],
    employeeRoles: [{ employee_id: 'e1', role_id: 'r-ahmash' }],
    availability: [], requests: [], vacations: [], requirements: [], settings: null, seed: 1,
  }
  it('an אחמ״ש-only employee yields engine roleIds for all three roles', () => {
    const { input } = mapToEngineInput(rows)
    expect(new Set(input.employees[0].roleIds)).toEqual(new Set(['אחמ״ש', 'מוקדן', 'מאבטח']))
  })
})
