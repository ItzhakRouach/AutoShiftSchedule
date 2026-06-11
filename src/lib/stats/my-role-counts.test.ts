import { describe, it, expect } from 'vitest'
import { countMyRoles } from './my-role-counts'
import type { ScheduleView } from '@/lib/schedule/view-data'

function view(over: Partial<ScheduleView> = {}): ScheduleView {
  return {
    periodId: 'p1',
    status: 'published',
    weekStart: '2026-06-07',
    days: [],
    shiftKeys: ['morning', 'noon', 'night'],
    roles: [
      { id: 'r-ahmash', name: 'אחמ״ש', color: '#111', rank: 3 },
      { id: 'r-guard', name: 'מאבטח', color: '#222', rank: 1 },
    ],
    employees: [],
    requirements: {},
    grid: {},
    twelve: [],
    temps: [],
    shiftTypeIdByKey: {},
    shiftMeta: {},
    hasAssignments: true,
    feasibility: null,
    requests: [],
    requestedSet: new Set(),
    dayNotes: [],
    ...over,
  } as ScheduleView
}

describe('countMyRoles', () => {
  it('counts base-shift assignments per role for the employee only', () => {
    const v = view({
      grid: {
        0: { morning: { 'r-guard': ['me', 'other'] } },
        1: { night: { 'r-ahmash': ['me'] } },
        2: { noon: { 'r-guard': ['other'] } },
      },
    })
    const { roles, total } = countMyRoles(v, 'me')
    expect(total).toBe(2)
    expect(roles).toEqual([
      { roleId: 'r-ahmash', name: 'אחמ״ש', color: '#111', count: 1 },
      { roleId: 'r-guard', name: 'מאבטח', color: '#222', count: 1 },
    ])
  })

  it('includes 12h shifts in the role tally', () => {
    const v = view({
      grid: { 0: { morning: { 'r-guard': ['me'] } } },
      twelve: [{ day: 3, variant: 'm12_day', roleId: 'r-guard', employeeId: 'me' }],
    })
    const { roles, total } = countMyRoles(v, 'me')
    expect(total).toBe(2)
    expect(roles).toEqual([{ roleId: 'r-guard', name: 'מאבטח', color: '#222', count: 2 }])
  })

  it('omits roles the employee has no shifts in', () => {
    const v = view({ grid: { 0: { morning: { 'r-guard': ['me'] } } } })
    const { roles } = countMyRoles(v, 'me')
    expect(roles.map((r) => r.roleId)).toEqual(['r-guard'])
  })

  it('returns empty when the employee has no shifts', () => {
    expect(countMyRoles(view(), 'me')).toEqual({ roles: [], total: 0 })
  })
})
