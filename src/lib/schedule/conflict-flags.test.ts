import { describe, it, expect } from 'vitest'
import { buildConflictFlags } from './conflict-flags'
import type { EditMeta, EmployeeEditMeta } from './edit-meta'
import type { ScheduleView } from './view-data'

function emp(over: Partial<EmployeeEditMeta> = {}): EmployeeEditMeta {
  return {
    id: 'e1', roleIds: [], availability: null, offDays: [], preferred: {},
    maxShifts: null, observesShabbat: false, committed: {}, absentDays: [], ...over,
  }
}

function meta(employees: Record<string, EmployeeEditMeta>, minRestHours = 8): EditMeta {
  return { minRestHours, keyToShiftTypeId: {}, employees }
}

function view(over: Partial<ScheduleView> = {}): ScheduleView {
  return {
    periodId: 'p', status: 'draft', weekStart: '2026-06-07',
    days: [], shiftKeys: ['morning', 'noon', 'night'], roles: [], employees: [],
    requirements: {}, grid: {}, twelve: [], temps: [],
    shiftTypeIdByKey: { morning: 's1', noon: 's2', night: 's3' },
    hasAssignments: true, feasibility: null, requests: [], requestedSet: new Set(),
    ...over,
  }
}

describe('buildConflictFlags', () => {
  it('returns empty map for read-only views (no editMeta)', () => {
    expect(buildConflictFlags(view(), null).size).toBe(0)
  })

  it('flags over-max: maxShifts=1 but assigned two days', () => {
    const v = view({ grid: { 0: { morning: { r: ['e1'] } }, 2: { morning: { r: ['e1'] } } } })
    const f = buildConflictFlags(v, meta({ e1: emp({ maxShifts: 1 }) }))
    expect(f.get('0:e1')).toBe('overmax')
    expect(f.get('2:e1')).toBe('overmax')
  })

  it('does not flag when within maxShifts and rest is fine', () => {
    const v = view({ grid: { 0: { morning: { r: ['e1'] } }, 3: { morning: { r: ['e1'] } } } })
    expect(buildConflictFlags(v, meta({ e1: emp({ maxShifts: 5 }) })).size).toBe(0)
  })

  it('flags min-rest breach: night then next-morning (0h gap < 8h)', () => {
    const v = view({ grid: { 0: { night: { r: ['e1'] } }, 1: { morning: { r: ['e1'] } } } })
    const f = buildConflictFlags(v, meta({ e1: emp({ maxShifts: 6 }) }))
    expect(f.get('0:e1')).toBe('rest')
    expect(f.get('1:e1')).toBe('rest')
  })

  it('rest outranks overmax on the same day', () => {
    // night d0 + morning d1 (rest breach) AND maxShifts 1 (over on both days)
    const v = view({ grid: { 0: { night: { r: ['e1'] } }, 1: { morning: { r: ['e1'] } } } })
    const f = buildConflictFlags(v, meta({ e1: emp({ maxShifts: 1 }) }))
    expect(f.get('0:e1')).toBe('rest')
    expect(f.get('1:e1')).toBe('rest')
  })
})
