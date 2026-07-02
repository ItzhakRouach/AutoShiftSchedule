import { describe, it, expect } from 'vitest'
import { buildWeekGrid, buildEmpTotals, cellCapacity } from './week-table-data'
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
    temps: [],
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

  it('places a temp worker in its exact cell with name + assignmentId', () => {
    const view = makeView({
      grid: {},
      temps: [{ day: 2, shiftKey: 'night', roleId: 'r-guard', assignmentId: 'a9', name: 'דני זמני' }],
    })
    const grid = buildWeekGrid(view)
    expect(grid[2]?.night?.['r-guard']).toEqual([
      { employeeId: '', is12h: false, requested: false, tempName: 'דני זמני', assignmentId: 'a9' },
    ])
  })
})

// buildWeekGrid 12h-expansion + coveredByTwelve behavior (legacy heuristic,
// cross-role fills, anchor gap-preference) is now pinned in
// week-table-twelve.test.ts, alongside the fills-aware helpers it tests.

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

describe('cellCapacity', () => {
  it('requirement 0 (unconfigured) → blank label, unconfigured status', () => {
    expect(cellCapacity(0, 0)).toEqual({ label: '', status: 'unconfigured' })
  })

  it('negative requirement is also treated as unconfigured', () => {
    expect(cellCapacity(0, -1)).toEqual({ label: '', status: 'unconfigured' })
  })

  it('0/2 → under', () => {
    expect(cellCapacity(0, 2)).toEqual({ label: '0/2', status: 'under' })
  })

  it('1/2 → under', () => {
    expect(cellCapacity(1, 2)).toEqual({ label: '1/2', status: 'under' })
  })

  it('2/2 → full', () => {
    expect(cellCapacity(2, 2)).toEqual({ label: '2/2', status: 'full' })
  })

  it('3/2 (over-staffed) → over', () => {
    expect(cellCapacity(3, 2)).toEqual({ label: '3/2', status: 'over' })
  })
})
