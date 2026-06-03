import { describe, it, expect } from 'vitest'
import { buildRequestedSet } from './view-data'
import { buildWeekGrid } from './week-table-data'
import type { ViewRequest, ScheduleView } from './view-data'

// ---- buildRequestedSet ----

describe('buildRequestedSet', () => {
  it('returns an empty set when there are no requests', () => {
    expect(buildRequestedSet([]).size).toBe(0)
  })

  it('ignores off requests', () => {
    const r: ViewRequest = { employeeId: 'e1', dayOfWeek: 0, isOff: true, preferredShiftIds: ['st1'] }
    expect(buildRequestedSet([r]).size).toBe(0)
  })

  it('ignores requests with empty preferredShiftIds', () => {
    const r: ViewRequest = { employeeId: 'e1', dayOfWeek: 0, isOff: false, preferredShiftIds: [] }
    expect(buildRequestedSet([r]).size).toBe(0)
  })

  it('adds one key per preferred shift id', () => {
    const r: ViewRequest = { employeeId: 'e1', dayOfWeek: 2, isOff: false, preferredShiftIds: ['st1', 'st2'] }
    const set = buildRequestedSet([r])
    expect(set.has('e1:2:st1')).toBe(true)
    expect(set.has('e1:2:st2')).toBe(true)
    expect(set.size).toBe(2)
  })

  it('handles multiple employees and days', () => {
    const requests: ViewRequest[] = [
      { employeeId: 'e1', dayOfWeek: 0, isOff: false, preferredShiftIds: ['st1'] },
      { employeeId: 'e2', dayOfWeek: 3, isOff: false, preferredShiftIds: ['st2'] },
      { employeeId: 'e1', dayOfWeek: 5, isOff: true, preferredShiftIds: ['st1'] }, // off — ignored
    ]
    const set = buildRequestedSet(requests)
    expect(set.has('e1:0:st1')).toBe(true)
    expect(set.has('e2:3:st2')).toBe(true)
    expect(set.size).toBe(2)
  })
})

// ---- buildWeekGrid requested flag ----

function makeView(overrides: Partial<ScheduleView> = {}): ScheduleView {
  return {
    periodId: 'p1',
    status: 'draft',
    weekStart: '2026-06-01',
    days: Array.from({ length: 7 }, (_, i) => ({ index: i, short: `${i}`, date: '' })),
    shiftKeys: ['morning', 'noon', 'night'],
    roles: [{ id: 'r1', name: 'אחמ״ש' }],
    employees: [{ id: 'e1', name: 'Alice', color: '#f00' }],
    requirements: {},
    grid: { 0: { morning: { r1: ['e1'] } } },
    twelve: [],
    shiftTypeIdByKey: { morning: 'st-morning', noon: 'st-noon', night: 'st-night' },
    hasAssignments: true,
    feasibility: null,
    requests: [],
    requestedSet: new Set<string>(),
    ...overrides,
  }
}

describe('buildWeekGrid — requested flag', () => {
  it('sets requested=false when no requests exist', () => {
    const view = makeView()
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r1']?.[0].requested).toBe(false)
  })

  it('sets requested=true when assignment matches a request', () => {
    const view = makeView({
      requestedSet: new Set(['e1:0:st-morning']),
    })
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r1']?.[0].requested).toBe(true)
  })

  it('sets requested=false for a different day even if shift matches', () => {
    // Request is for day 1, assignment is on day 0
    const view = makeView({
      requestedSet: new Set(['e1:1:st-morning']),
    })
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r1']?.[0].requested).toBe(false)
  })

  it('sets requested=true on the 12h anchor cell if any covered base shift was requested', () => {
    // m12_day covers morning + noon; employee requested morning. The 12h now
    // shows in its anchor (morning) only; noon stays empty (covered).
    const view = makeView({
      grid: {},
      twelve: [{ day: 0, variant: 'm12_day', roleId: 'r1', employeeId: 'e1' }],
      requestedSet: new Set(['e1:0:st-morning']),
    })
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r1']?.[0].requested).toBe(true)
    expect(grid[0]?.noon?.['r1'] ?? []).toHaveLength(0)
  })
})
