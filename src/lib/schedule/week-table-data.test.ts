import { describe, it, expect } from 'vitest'
import { buildWeekGrid, buildEmpTotals } from './week-table-data'
import type { ScheduleView } from './view-data'

function makeView(overrides: Partial<ScheduleView> = {}): ScheduleView {
  return {
    periodId: 'p1',
    status: 'draft',
    weekStart: '2026-06-01',
    days: Array.from({ length: 7 }, (_, i) => ({ index: i, short: `${i}`, date: '' })),
    shiftKeys: ['morning', 'noon', 'night'],
    roles: [
      { id: 'r-achm', name: 'אחמ״ש' },
      { id: 'r-moked', name: 'מוקדן' },
      { id: 'r-guard', name: 'מאבטח' },
    ],
    employees: [
      { id: 'e1', name: 'Alice', color: '#f00' },
      { id: 'e2', name: 'Bob', color: '#00f' },
    ],
    requirements: {
      0: {
        morning: { 'r-achm': 1, 'r-moked': 1, 'r-guard': 1 },
        noon:    { 'r-achm': 1, 'r-moked': 1, 'r-guard': 1 },
        night:   { 'r-achm': 1, 'r-moked': 1, 'r-guard': 1 },
      },
    },
    grid: {
      0: {
        morning: { 'r-achm': ['e1'] },
        noon:    { 'r-moked': ['e2'] },
        night:   {},
      },
    },
    twelve: [],
    shiftTypeIdByKey: { morning: 'st1', noon: 'st2', night: 'st3' },
    hasAssignments: true,
    feasibility: null,
    requests: [],
    requestedSet: new Set<string>(),
    ...overrides,
  }
}

describe('buildWeekGrid — base assignments', () => {
  it('copies base assignments into grid as is12h:false', () => {
    const view = makeView()
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r-achm']).toEqual([{ employeeId: 'e1', is12h: false, requested: false }])
    expect(grid[0]?.noon?.['r-moked']).toEqual([{ employeeId: 'e2', is12h: false, requested: false }])
  })

  it('empty cell has no entries', () => {
    const view = makeView()
    const grid = buildWeekGrid(view)
    expect(grid[0]?.night?.['r-achm'] ?? []).toHaveLength(0)
  })
})

describe('buildWeekGrid — 12h expansion', () => {
  it('expands m12_day into morning and noon cells with is12h:true', () => {
    // m12_day fills ['morning', 'noon'] per TWELVE_HOUR_FILLS
    const view = makeView({
      grid: {},
      twelve: [{ day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' }],
    })
    const grid = buildWeekGrid(view)
    const morn = grid[0]?.morning?.['r-guard'] ?? []
    const noon = grid[0]?.noon?.['r-guard'] ?? []
    expect(morn).toEqual([{ employeeId: 'e1', is12h: true, requested: false }])
    expect(noon).toEqual([{ employeeId: 'e1', is12h: true, requested: false }])
    // night should be empty
    expect(grid[0]?.night?.['r-guard'] ?? []).toHaveLength(0)
  })

  it('expands m12_night into night only', () => {
    // m12_night fills ['night'] per TWELVE_HOUR_FILLS
    const view = makeView({
      grid: {},
      twelve: [{ day: 1, variant: 'm12_night', roleId: 'r-achm', employeeId: 'e2' }],
    })
    const grid = buildWeekGrid(view)
    expect(grid[1]?.night?.['r-achm'] ?? []).toEqual([{ employeeId: 'e2', is12h: true, requested: false }])
    expect(grid[1]?.morning?.['r-achm'] ?? []).toHaveLength(0)
  })
})

describe('buildEmpTotals', () => {
  it('counts base assignments per employee', () => {
    const view = makeView()
    const totals = buildEmpTotals(view, view.employees)
    expect(totals['e1']).toBe(1) // morning r-achm
    expect(totals['e2']).toBe(1) // noon r-moked
  })

  it('counts a 12h assignment as 1, not once per covered shift', () => {
    const view = makeView({
      grid: {},
      // m12_day covers morning+noon → should still count as 1 shift for e1
      twelve: [{ day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' }],
    })
    const totals = buildEmpTotals(view, view.employees)
    expect(totals['e1']).toBe(1)
    expect(totals['e2']).toBe(0)
  })

  it('does not double-count same 12h via two twelve entries', () => {
    const view = makeView({
      grid: {},
      twelve: [
        { day: 0, variant: 'm12_day', roleId: 'r-achm', employeeId: 'e1' },
        { day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' }, // same day+variant+emp
      ],
    })
    const totals = buildEmpTotals(view, view.employees)
    // Different roleId but same (day, variant, emp) key → deduplicated → 1
    expect(totals['e1']).toBe(1)
  })

  it('counts multiple different 12h shifts for same employee', () => {
    const view = makeView({
      grid: {},
      twelve: [
        { day: 0, variant: 'm12_day',   roleId: 'r-guard', employeeId: 'e1' },
        { day: 2, variant: 'm12_night', roleId: 'r-achm',  employeeId: 'e1' },
      ],
    })
    const totals = buildEmpTotals(view, view.employees)
    expect(totals['e1']).toBe(2)
  })
})
