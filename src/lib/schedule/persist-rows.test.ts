import { describe, it, expect } from 'vitest'
import { buildAssignmentRows, type BuildAssignmentRowsContext } from './persist-rows'
import type { EngineResult } from '@/lib/scheduling/types'

type ResultInput = Pick<EngineResult, 'twelveHourAssignments' | 'assignmentsByEmployee'>

const PERIOD_ID = 'period-1'

function baseCtx(overrides: Partial<BuildAssignmentRowsContext> = {}): BuildAssignmentRowsContext {
  return {
    periodId: PERIOD_ID,
    allKeyToShiftTypeId: {
      morning: 'st-morning',
      noon: 'st-noon',
      night: 'st-night',
      m12_day: 'st-m12-day',
      m12_night: 'st-m12-night',
    },
    keyToShiftTypeId: {
      morning: 'st-morning',
      noon: 'st-noon',
      night: 'st-night',
    },
    nameToRoleId: {
      'אחמ"ש': 'role-ahmash',
      מוקדן: 'role-mokdan',
      מאבטח: 'role-mavtach',
    },
    preservedRows: [],
    replaceManual: false,
    ...overrides,
  }
}

function emptyResult(overrides: Partial<ResultInput> = {}): ResultInput {
  return {
    twelveHourAssignments: [],
    assignmentsByEmployee: {},
    ...overrides,
  }
}

describe('buildAssignmentRows', () => {
  it('produces ONE canonical row for a 12h assignment and skips the covered base cells', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        {
          employeeId: 'emp-1',
          day: 2,
          variant: 'm12_day',
          rolesByShift: { morning: 'אחמ"ש', noon: 'אחמ"ש' },
        },
      ],
      assignmentsByEmployee: {
        'emp-1': [
          { employeeId: 'emp-1', day: 2, shift: 'morning', roleId: 'אחמ"ש', is12h: true, variant: 'm12_day' },
          { employeeId: 'emp-1', day: 2, shift: 'noon', roleId: 'אחמ"ש', is12h: true, variant: 'm12_day' },
        ],
      },
    }

    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      period_id: PERIOD_ID,
      employee_id: 'emp-1',
      day_of_week: 2,
      shift_type_id: 'st-m12-day',
      role_id: 'role-ahmash',
      source: 'auto',
    })
    expect(rows[0].twelve_fills).toEqual([
      { shift: 'morning', role_id: 'role-ahmash' },
      { shift: 'noon', role_id: 'role-ahmash' },
    ])
  })

  it('skips preserved (employee, day) pairs when replaceManual is false', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        { employeeId: 'emp-1', day: 0, variant: 'm12_night', rolesByShift: { night: 'מאבטח' } },
      ],
      assignmentsByEmployee: {
        'emp-2': [{ employeeId: 'emp-2', day: 1, shift: 'morning', roleId: 'מוקדן' }],
      },
    }
    const ctx = baseCtx({
      preservedRows: [
        { employee_id: 'emp-1', day_of_week: 0 },
        { employee_id: 'emp-2', day_of_week: 1 },
      ],
      replaceManual: false,
    })

    const rows = buildAssignmentRows(result, ctx)

    expect(rows).toEqual([])
  })

  it('does NOT skip preserved pairs when replaceManual is true', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        { employeeId: 'emp-1', day: 0, variant: 'm12_night', rolesByShift: { night: 'מאבטח' } },
      ],
      assignmentsByEmployee: {},
    }
    const ctx = baseCtx({
      preservedRows: [{ employee_id: 'emp-1', day_of_week: 0 }],
      replaceManual: true,
    })

    const rows = buildAssignmentRows(result, ctx)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      period_id: PERIOD_ID,
      employee_id: 'emp-1',
      day_of_week: 0,
      shift_type_id: 'st-m12-night',
      role_id: 'role-mavtach',
      source: 'auto',
    })
    expect(rows[0].twelve_fills).toEqual([{ shift: 'night', role_id: 'role-mavtach' }])
  })

  it('maps plain 8h assignments to day/shift/role/source correctly', () => {
    const result: ResultInput = emptyResult({
      assignmentsByEmployee: {
        'emp-3': [
          { employeeId: 'emp-3', day: 3, shift: 'noon', roleId: 'מוקדן' },
          { employeeId: 'emp-3', day: 4, shift: 'night', roleId: 'מאבטח' },
        ],
      },
    })

    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toEqual([
      { period_id: PERIOD_ID, employee_id: 'emp-3', day_of_week: 3, shift_type_id: 'st-noon', role_id: 'role-mokdan', source: 'auto', twelve_fills: null },
      { period_id: PERIOD_ID, employee_id: 'emp-3', day_of_week: 4, shift_type_id: 'st-night', role_id: 'role-mavtach', source: 'auto', twelve_fills: null },
    ])
  })

  it('never emits duplicate (employee, day) rows — 12h canonical row wins over a stray 8h entry for the same day', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        { employeeId: 'emp-1', day: 5, variant: 'm12_day', rolesByShift: { morning: 'אחמ"ש' } },
      ],
      assignmentsByEmployee: {
        'emp-1': [
          // Same (employee, day) as the 12h row above, but NOT flagged is12h —
          // should still be deduped by the seen-set, not just the is12h flag.
          { employeeId: 'emp-1', day: 5, shift: 'noon', roleId: 'אחמ"ש' },
        ],
      },
    }

    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ employee_id: 'emp-1', day_of_week: 5, shift_type_id: 'st-m12-day' })
  })

  it('skips rows with unresolvable shift_type_id or role_id instead of throwing', () => {
    const result: ResultInput = emptyResult({
      assignmentsByEmployee: {
        'emp-4': [{ employeeId: 'emp-4', day: 1, shift: 'morning', roleId: 'unknown-role' }],
      },
    })

    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toEqual([])
  })

  it('skips 12h rows with unresolvable variant shift_type_id', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        { employeeId: 'emp-5', day: 1, variant: 'm12_3to15', rolesByShift: { morning: 'אחמ"ש' } },
      ],
      assignmentsByEmployee: {},
    }

    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toEqual([])
  })

  it('returns an empty array for an empty engine result', () => {
    const rows = buildAssignmentRows(emptyResult(), baseCtx())
    expect(rows).toEqual([])
  })
})
