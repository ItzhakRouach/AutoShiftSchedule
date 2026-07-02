import { describe, it, expect } from 'vitest'
import { buildWeekGrid } from './week-table-data'
import { coveredByTwelve } from './week-table-twelve'
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

describe('legacy (fills undefined) — pinned to today\'s behavior', () => {
  it('places m12_day in its anchor (morning) only; noon is covered (physical heuristic), not filled', () => {
    const view = makeView({
      grid: {},
      twelve: [{ day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' }],
    })
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r-guard'] ?? []).toEqual([{ employeeId: 'e1', is12h: true, requested: false, variant: 'm12_day' }])
    expect(grid[0]?.noon?.['r-guard'] ?? []).toHaveLength(0)
    expect(grid[0]?.night?.['r-guard'] ?? []).toHaveLength(0)
    const covered = coveredByTwelve(view)
    expect(covered.get('0:noon:r-guard')).toBe(1)
  })

  it('expands m12_night into night only', () => {
    const view = makeView({
      grid: {},
      twelve: [{ day: 1, variant: 'm12_night', roleId: 'r-achm', employeeId: 'e2' }],
    })
    const grid = buildWeekGrid(view)
    expect(grid[1]?.night?.['r-achm'] ?? []).toEqual([{ employeeId: 'e2', is12h: true, requested: false, variant: 'm12_night' }])
    expect(grid[1]?.morning?.['r-achm'] ?? []).toHaveLength(0)
  })

  it('m12_night marks noon as covered at the 12h person\'s role (physical overlap, legacy heuristic)', () => {
    const view = makeView({
      grid: {},
      twelve: [{ day: 1, variant: 'm12_night', roleId: 'r-moked', employeeId: 'e2' }],
    })
    const covered = coveredByTwelve(view)
    expect(covered.get('1:noon:r-moked')).toBe(1)
    expect(covered.has('1:night:r-moked')).toBe(false) // anchor — the name lives here
  })
})

describe('anchor gap-preference (legacy synthesis, no fills)', () => {
  it('when the first FILLS shift is already base-staffed, the chip lands at the next fill', () => {
    // m12_day fills [morning, noon]. morning already has a base occupant at
    // this role → anchor should skip to noon.
    const view = makeView({
      grid: { 0: { morning: { 'r-guard': ['e2'] }, noon: {}, night: {} } },
      twelve: [{ day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' }],
    })
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r-guard']).toEqual([{ employeeId: 'e2', is12h: false, requested: false }])
    expect(grid[0]?.noon?.['r-guard'] ?? []).toEqual([{ employeeId: 'e1', is12h: true, requested: false, variant: 'm12_day' }])
  })
})

describe('fills-bearing rows — cross-role placement (the screenshot bug)', () => {
  it('cross-role m12_day fills=[{morning,roleA},{noon,roleB}] → chip in morning under roleA, covered count 1 at noon:roleB (NOT roleA)', () => {
    const view = makeView({
      grid: {},
      twelve: [{
        day: 0, variant: 'm12_day', roleId: 'r-achm', employeeId: 'e1',
        fills: [{ shift: 'morning', roleId: 'r-guard' }, { shift: 'noon', roleId: 'r-moked' }],
      }],
    })
    const grid = buildWeekGrid(view)
    // Chip lands under roleA (r-guard) at morning — NOT under t.roleId (r-achm).
    expect(grid[0]?.morning?.['r-guard'] ?? []).toEqual([{ employeeId: 'e1', is12h: true, requested: false, variant: 'm12_day' }])
    expect(grid[0]?.morning?.['r-achm'] ?? []).toHaveLength(0)
    const covered = coveredByTwelve(view)
    // Covered noon under roleB (r-moked), count 1 — not under roleA.
    expect(covered.get('0:noon:r-moked')).toBe(1)
    expect(covered.has('0:noon:r-guard')).toBe(false)
  })

  it('two 12h same day different roles never stack into one cell', () => {
    // Two separate 12h people, same day/variant window family, but different
    // roles — must never collapse into the same cell.
    const view = makeView({
      grid: {},
      twelve: [
        {
          day: 0, variant: 'm12_day', roleId: 'r-achm', employeeId: 'e1',
          fills: [{ shift: 'morning', roleId: 'r-achm' }, { shift: 'noon', roleId: 'r-achm' }],
        },
        {
          day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e2',
          fills: [{ shift: 'morning', roleId: 'r-guard' }, { shift: 'noon', roleId: 'r-guard' }],
        },
      ],
    })
    const grid = buildWeekGrid(view)
    expect(grid[0]?.morning?.['r-achm'] ?? []).toEqual([{ employeeId: 'e1', is12h: true, requested: false, variant: 'm12_day' }])
    expect(grid[0]?.morning?.['r-guard'] ?? []).toEqual([{ employeeId: 'e2', is12h: true, requested: false, variant: 'm12_day' }])
    // Not stacked into a single cell/role.
    expect(grid[0]?.morning?.['r-achm']).toHaveLength(1)
    expect(grid[0]?.morning?.['r-guard']).toHaveLength(1)
  })

  it('two 12h same (shift,role) with requirement 2 → covered count 2', () => {
    const view = makeView({
      grid: {},
      twelve: [
        {
          day: 0, variant: 'm12_day', roleId: 'r-achm', employeeId: 'e1',
          fills: [{ shift: 'morning', roleId: 'r-achm' }, { shift: 'noon', roleId: 'r-achm' }],
        },
        {
          day: 0, variant: 'm12_day', roleId: 'r-achm', employeeId: 'e2',
          fills: [{ shift: 'morning', roleId: 'r-achm' }, { shift: 'noon', roleId: 'r-achm' }],
        },
      ],
    })
    const covered = coveredByTwelve(view)
    expect(covered.get('0:noon:r-achm')).toBe(2)
  })

  it('manual m12_night fills=[{night,role}] → night chip only, noon NOT covered (strict fills rule)', () => {
    const view = makeView({
      grid: {},
      twelve: [{
        day: 1, variant: 'm12_night', roleId: 'r-moked', employeeId: 'e2',
        fills: [{ shift: 'night', roleId: 'r-moked' }],
      }],
    })
    const grid = buildWeekGrid(view)
    expect(grid[1]?.night?.['r-moked'] ?? []).toEqual([{ employeeId: 'e2', is12h: true, requested: false, variant: 'm12_night' }])
    const covered = coveredByTwelve(view)
    // Strict: only the fills array counts — no physical TWELVE_HOUR_COVERS
    // marking for fills-bearing rows. m12_night's single fill IS the anchor,
    // so nothing else is covered — noon must NOT be marked covered.
    expect(covered.has('1:noon:r-moked')).toBe(false)
    expect(covered.size).toBe(0)
  })

  it('anchor gap-preference with fills: base-staffed first fill → chip lands at the next fill', () => {
    const view = makeView({
      grid: { 0: { morning: { 'r-guard': ['e2'] }, noon: {}, night: {} } },
      twelve: [{
        day: 0, variant: 'm12_day', roleId: 'r-achm', employeeId: 'e1',
        fills: [{ shift: 'morning', roleId: 'r-guard' }, { shift: 'noon', roleId: 'r-moked' }],
      }],
    })
    const grid = buildWeekGrid(view)
    // morning:r-guard is base-occupied → anchor skips to noon:r-moked.
    expect(grid[0]?.morning?.['r-guard']).toEqual([{ employeeId: 'e2', is12h: false, requested: false }])
    expect(grid[0]?.noon?.['r-moked'] ?? []).toEqual([{ employeeId: 'e1', is12h: true, requested: false, variant: 'm12_day' }])
    const covered = coveredByTwelve(view)
    // The non-anchor fill (morning:r-guard) is skipped from covered because
    // it's base-occupied — consistent with the "don't overwrite a real name" rule.
    expect(covered.has('0:morning:r-guard')).toBe(false)
  })
})
