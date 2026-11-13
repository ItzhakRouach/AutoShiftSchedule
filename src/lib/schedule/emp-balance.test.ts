import { describe, it, expect } from 'vitest'
import { buildEmpBalance, sortBalanceRows } from './emp-balance'
import { buildEmpDistribution } from './emp-distribution'
import { buildRequestedSet, type ViewRequest } from './view-types'
import type { ScheduleView } from './view-data'

// Local fixture, matching the convention in emp-distribution.test.ts.
function makeView(overrides: Partial<ScheduleView> = {}): ScheduleView {
  const requests: ViewRequest[] = overrides.requests ?? []
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
      { id: 'e3', name: 'Carol', color: '#0f0' },
    ],
    requirements: {},
    grid: {},
    twelve: [],
    temps: [],
    shiftTypeIdByKey: { morning: 'st1', noon: 'st2', night: 'st3' },
    hasAssignments: true,
    feasibility: null,
    requestedSet: buildRequestedSet(requests),
    ...overrides,
    requests,
  }
}

const rowOf = (view: ScheduleView, id: string) =>
  buildEmpBalance(view).find((r) => r.employeeId === id)!

describe('buildEmpBalance — role counts', () => {
  it('counts each base shift under the role it was worked in', () => {
    const view = makeView({
      grid: {
        0: { morning: { 'r-achm': ['e1'] } },
        1: { night: { 'r-guard': ['e1'] } },
        2: { noon: { 'r-guard': ['e1', 'e2'] } },
      },
    })
    expect(rowOf(view, 'e1').roleCounts).toEqual({ 'r-achm': 1, 'r-guard': 2 })
    expect(rowOf(view, 'e2').roleCounts).toEqual({ 'r-guard': 1 })
    expect(rowOf(view, 'e3').roleCounts).toEqual({})
  })

  it('counts a 12h shift once even when it appears as several rows', () => {
    const view = makeView({
      twelve: [
        { day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' },
        { day: 0, variant: 'm12_day', roleId: 'r-achm', employeeId: 'e1' },
      ],
    })
    expect(rowOf(view, 'e1').roleCounts).toEqual({ 'r-guard': 1 })
  })

  it('role counts always sum to the distribution total', () => {
    const view = makeView({
      grid: { 0: { morning: { 'r-achm': ['e1'] } }, 3: { night: { 'r-guard': ['e1'] } } },
      twelve: [{ day: 5, variant: 'm12_night', roleId: 'r-guard', employeeId: 'e1' }],
    })
    const row = rowOf(view, 'e1')
    const sum = Object.values(row.roleCounts).reduce((a, b) => a + b, 0)
    expect(sum).toBe(row.total)
    expect(row.total).toBe(buildEmpDistribution(view).rows[0].total)
    expect(row.twelve).toBe(1)
  })
})

describe('buildEmpBalance — requests', () => {
  const req = (employeeId: string, dayOfWeek: number, ids: string[], isOff = false): ViewRequest =>
    ({ employeeId, dayOfWeek, isOff, preferredShiftIds: ids })

  it('asked counts days with a shift request; off-days and empty rows do not count', () => {
    const view = makeView({
      requests: [req('e1', 0, ['st1']), req('e1', 1, ['st1', 'st2']), req('e1', 2, [], true), req('e1', 3, [])],
    })
    expect(rowOf(view, 'e1').asked).toBe(2)
    expect(rowOf(view, 'e1').got).toBe(0)
  })

  it('got counts a day once when the assigned shift is one of those requested', () => {
    const view = makeView({
      requests: [req('e1', 0, ['st1']), req('e1', 1, ['st1', 'st2']), req('e1', 4, ['st3'])],
      grid: {
        0: { morning: { 'r-achm': ['e1'] } }, // requested → got
        1: { night: { 'r-guard': ['e1'] } }, // asked morning/noon, got night → not
      },
    })
    const row = rowOf(view, 'e1')
    expect(row.asked).toBe(3)
    expect(row.got).toBe(1)
  })

  it('a 12h shift honors a request when one of the windows it fills was requested', () => {
    const view = makeView({
      requests: [req('e1', 0, ['st2']), req('e2', 0, ['st3'])],
      twelve: [
        { day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1', fills: [{ shift: 'morning', roleId: 'r-guard' }, { shift: 'noon', roleId: 'r-guard' }] },
        { day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e2', fills: [{ shift: 'morning', roleId: 'r-guard' }, { shift: 'noon', roleId: 'r-guard' }] },
      ],
    })
    expect(rowOf(view, 'e1').got).toBe(1)
    expect(rowOf(view, 'e2').got).toBe(0)
  })
})

describe('sortBalanceRows', () => {
  const view = makeView({
    requests: [
      { employeeId: 'e1', dayOfWeek: 0, isOff: false, preferredShiftIds: ['st1'] },
      { employeeId: 'e2', dayOfWeek: 0, isOff: false, preferredShiftIds: ['st2'] },
    ],
    grid: {
      0: { morning: { 'r-achm': ['e1'] }, night: { 'r-guard': ['e2'] } },
      1: { morning: { 'r-achm': ['e1'] }, night: { 'r-guard': ['e2'] } },
      2: { morning: { 'r-achm': ['e1'] } },
    },
  })
  const ids = (mode: Parameters<typeof sortBalanceRows>[1]) =>
    sortBalanceRows(buildEmpBalance(view), mode).map((r) => r.employeeId)

  it('total: busiest first', () => expect(ids('total')).toEqual(['e1', 'e2', 'e3']))
  it('nights: most nights first', () => expect(ids('nights')).toEqual(['e2', 'e1', 'e3']))
  it('requests: least-honored first, workers with no requests last', () =>
    expect(ids('requests')).toEqual(['e2', 'e1', 'e3']))
  it('does not mutate its input', () => {
    const rows = buildEmpBalance(view)
    const before = rows.map((r) => r.employeeId)
    sortBalanceRows(rows, 'nights')
    expect(rows.map((r) => r.employeeId)).toEqual(before)
  })
})
