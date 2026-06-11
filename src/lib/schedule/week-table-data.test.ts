import { describe, it, expect } from 'vitest'
import { buildWeekGrid, buildEmpTotals, coveredByTwelve } from './week-table-data'
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

describe('buildWeekGrid — 12h expansion', () => {
  it('places m12_day in its anchor (morning) only; noon is covered, not filled', () => {
    // m12_day fills ['morning', 'noon'] → anchor = morning; noon stays empty (covered).
    const view = makeView({
      grid: {},
      twelve: [{ day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' }],
    })
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r-guard'] ?? []).toEqual([{ employeeId: 'e1', is12h: true, requested: false, variant: 'm12_day' }])
    // noon is left EMPTY in the grid…
    expect(grid[0]?.noon?.['r-guard'] ?? []).toHaveLength(0)
    expect(grid[0]?.night?.['r-guard'] ?? []).toHaveLength(0)
    // …but flagged covered (so the table won't mark it "unfilled").
    expect(coveredByTwelve(view).has('0:noon:r-guard')).toBe(true)
  })

  it('expands m12_night into night only', () => {
    // m12_night fills ['night'] per TWELVE_HOUR_FILLS
    const view = makeView({
      grid: {},
      twelve: [{ day: 1, variant: 'm12_night', roleId: 'r-achm', employeeId: 'e2' }],
    })
    const grid = buildWeekGrid(view)
    expect(grid[1]?.night?.['r-achm'] ?? []).toEqual([{ employeeId: 'e2', is12h: true, requested: false, variant: 'm12_night' }])
    expect(grid[1]?.morning?.['r-achm'] ?? []).toHaveLength(0)
  })

  it('m12_night marks noon as covered at the 12h person\'s role (physical overlap)', () => {
    // m12_night = 19–07; physically covers ['noon','night']. Anchor=night. So
    // an empty noon cell at the SAME role (e.g. מוקדן when the wizard pair was
    // אחמ״ש) should render the 12ש׳ chip — not "לא מאויש".
    const view = makeView({
      grid: {},
      twelve: [{ day: 1, variant: 'm12_night', roleId: 'r-moked', employeeId: 'e2' }],
    })
    const covered = coveredByTwelve(view)
    expect(covered.has('1:noon:r-moked')).toBe(true)
    expect(covered.has('1:night:r-moked')).toBe(false) // anchor — the name lives here
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
