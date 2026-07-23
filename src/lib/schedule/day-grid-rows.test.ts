import { describe, it, expect } from 'vitest'
import { buildWeekGrid } from './week-table-data'
import { coveredByTwelve } from './week-table-twelve'
import { buildDayRoleRow, dayRoleIds } from './day-grid-rows'
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
      { id: 'r-guard', name: 'מאבטח' },
    ],
    employees: [
      { id: 'e1', name: 'Alice', color: '#f00' },
      { id: 'e2', name: 'Bob', color: '#00f' },
    ],
    requirements: {
      0: {
        morning: { 'r-achm': 1 },
        noon: { 'r-achm': 1 },
        night: { 'r-achm': 1 },
      },
    },
    grid: { 0: { morning: {}, noon: {}, night: {} } },
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

/** A 07–19 12h day shift: fills morning (anchor) + noon for the same role. */
function viewWithTwelveDay(): ScheduleView {
  return makeView({
    twelve: [
      {
        day: 0,
        variant: 'm12_day',
        roleId: 'r-achm',
        employeeId: 'e1',
        fills: [
          { shift: 'morning', roleId: 'r-achm' },
          { shift: 'noon', roleId: 'r-achm' },
        ],
      },
    ],
  })
}

function rowsFor(view: ScheduleView, shift: string, roleId: string) {
  const weekGrid = buildWeekGrid(view)
  const coveredMap = coveredByTwelve(view)
  return buildDayRoleRow(view, weekGrid, coveredMap, 0, shift, roleId)
}

describe('buildDayRoleRow — 12h coverage semantics (WeekTable parity)', () => {
  it('anchor shift shows the 12h entry and is not missing', () => {
    const row = rowsFor(viewWithTwelveDay(), 'morning', 'r-achm')
    expect(row.entries).toHaveLength(1)
    expect(row.entries[0]).toMatchObject({ employeeId: 'e1', is12h: true, variant: 'm12_day' })
    expect(row.assigned).toBe(1)
    expect(row.missing).toBe(0)
  })

  it('covered (non-anchor) shift counts toward the target with no entries', () => {
    const row = rowsFor(viewWithTwelveDay(), 'noon', 'r-achm')
    expect(row.entries).toHaveLength(0)
    expect(row.covered).toBe(1)
    expect(row.assigned).toBe(1)
    expect(row.missing).toBe(0)
  })

  it('uncovered shift still reports missing', () => {
    const row = rowsFor(viewWithTwelveDay(), 'night', 'r-achm')
    expect(row.assigned).toBe(0)
    expect(row.missing).toBe(1)
  })

  it('baseIds excludes 12h and temp entries (slot editor input)', () => {
    const view = viewWithTwelveDay()
    view.grid = { 0: { morning: { 'r-achm': ['e2'] }, noon: {}, night: {} } }
    view.temps = [{ day: 0, shiftKey: 'morning', roleId: 'r-achm', assignmentId: 'a1', name: 'זמני' }]
    // Morning is occupied by a base worker, so the 12h anchor slides to noon
    // (twelveAnchor never stacks the name onto an occupied cell).
    const morning = rowsFor(view, 'morning', 'r-achm')
    expect(morning.entries.length).toBe(2) // base + temp
    expect(morning.baseIds).toEqual(['e2'])
    const noon = rowsFor(view, 'noon', 'r-achm')
    expect(noon.entries.length).toBe(1)
    expect(noon.entries[0]).toMatchObject({ employeeId: 'e1', is12h: true })
    expect(noon.baseIds).toEqual([])
  })
})

describe('dayRoleIds', () => {
  it('includes a covered-only role even with no requirements (employee view)', () => {
    const view = viewWithTwelveDay()
    view.requirements = {} // published employee view has no requirements (RLS)
    const weekGrid = buildWeekGrid(view)
    const coveredMap = coveredByTwelve(view)
    expect(dayRoleIds(view, weekGrid, coveredMap, 0, 'noon')).toEqual(['r-achm'])
    expect(dayRoleIds(view, weekGrid, coveredMap, 0, 'night')).toEqual([])
  })

  it('orders by view.roles and includes required + assigned roles', () => {
    const view = makeView({ grid: { 0: { morning: { 'r-guard': ['e2'] }, noon: {}, night: {} } } })
    const weekGrid = buildWeekGrid(view)
    const coveredMap = coveredByTwelve(view)
    expect(dayRoleIds(view, weekGrid, coveredMap, 0, 'morning')).toEqual(['r-achm', 'r-guard'])
  })
})
