// TDD for the twelve_fills column on buildAssignmentRows (see persist-rows.ts
// and twelve-fills.ts). Kept in a separate file — persist-rows.test.ts is
// already near the 200-line cap (CLAUDE.md file-size rule).
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

describe('buildAssignmentRows — twelve_fills', () => {
  it('cross-role m12_day plan produces one row with role_id=first-fill role and 2 fills in FILLS order', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        {
          employeeId: 'emp-1',
          day: 2,
          variant: 'm12_day',
          rolesByShift: { morning: 'מוקדן', noon: 'אחמ"ש' },
        },
      ],
      assignmentsByEmployee: {
        'emp-1': [
          { employeeId: 'emp-1', day: 2, shift: 'morning', roleId: 'מוקדן', is12h: true, variant: 'm12_day' },
          { employeeId: 'emp-1', day: 2, shift: 'noon', roleId: 'אחמ"ש', is12h: true, variant: 'm12_day' },
        ],
      },
    }

    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      employee_id: 'emp-1',
      day_of_week: 2,
      role_id: 'role-mokdan', // first covered shift (morning) in Object.keys order
    })
    expect(rows[0].twelve_fills).toEqual([
      { shift: 'morning', role_id: 'role-mokdan' },
      { shift: 'noon', role_id: 'role-ahmash' },
    ])
  })

  it('m12_night produces one row with a single fill entry', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        { employeeId: 'emp-2', day: 0, variant: 'm12_night', rolesByShift: { night: 'מאבטח' } },
      ],
      assignmentsByEmployee: {},
    }

    const rows = buildAssignmentRows(result, baseCtx({
      allKeyToShiftTypeId: {
        morning: 'st-morning', noon: 'st-noon', night: 'st-night', m12_night: 'st-m12-night',
      },
    }))

    expect(rows).toHaveLength(1)
    expect(rows[0].role_id).toBe('role-mavtach')
    expect(rows[0].twelve_fills).toEqual([{ shift: 'night', role_id: 'role-mavtach' }])
  })

  it('keeps the row with 1 fill when the second role is unresolvable', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        {
          employeeId: 'emp-3',
          day: 1,
          variant: 'm12_day',
          rolesByShift: { morning: 'מוקדן', noon: 'לא קיים' },
        },
      ],
      assignmentsByEmployee: {},
    }

    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toHaveLength(1)
    expect(rows[0].role_id).toBe('role-mokdan')
    expect(rows[0].twelve_fills).toEqual([{ shift: 'morning', role_id: 'role-mokdan' }])
  })

  it('skips the row entirely when every fill role is unresolvable', () => {
    const result: ResultInput = {
      twelveHourAssignments: [
        {
          employeeId: 'emp-4',
          day: 1,
          variant: 'm12_day',
          rolesByShift: { morning: 'לא קיים', noon: 'גם לא' },
        },
      ],
      assignmentsByEmployee: {},
    }

    // role_id resolution for the persisted row still relies on the FIRST
    // covered shift's role name — if it's unresolvable, roleId is falsy and
    // the row is skipped (existing back-compat behavior), independent of fills.
    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toEqual([])
  })

  it('8h rows get an explicit twelve_fills: null', () => {
    const result: ResultInput = emptyResult({
      assignmentsByEmployee: {
        'emp-5': [{ employeeId: 'emp-5', day: 3, shift: 'noon', roleId: 'מוקדן' }],
      },
    })

    const rows = buildAssignmentRows(result, baseCtx())

    expect(rows).toHaveLength(1)
    expect(rows[0].twelve_fills).toBeNull()
  })
})
