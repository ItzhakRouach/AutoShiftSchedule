// The AI improvement starts from the schedule AS SAVED (manual edits, 12h
// blocks, temps), not from a fresh engine run — so the loader must rebuild the
// same grid/committed/satisfied the engine itself would hold for that week.
import { describe, it, expect } from 'vitest'
import { stateFromRows, TEMP_OCCUPANT } from './state-from-rows'
import { emp, input, reqFor, mergeReqs, buildRequests, GUARD, SHIFT_MGR } from '@/lib/scheduling/fixtures'

const week = () => {
  const employees = ['u1', 'u2', 'u3'].map((id) => emp(id, { roleIds: [GUARD, SHIFT_MGR] }))
  return input({
    employees,
    requirements: mergeReqs(
      reqFor([0, 1], 'morning', GUARD, 1),
      reqFor([0, 1], 'noon', GUARD, 1),
      reqFor([0, 1], 'night', GUARD, 1),
    ),
    requests: buildRequests(employees, (id, day) => (id === 'u1' && day === 0 ? { preferred: ['morning'] } : {})),
  })
}

describe('stateFromRows', () => {
  it('places 8h rows in the grid and in committed', () => {
    const st = stateFromRows(week(), [
      { employeeId: 'u1', day: 0, shiftKey: 'morning', roleName: GUARD, fills: null },
      { employeeId: 'u2', day: 0, shiftKey: 'night', roleName: GUARD, fills: null },
    ])
    expect(st.grid[0].morning[GUARD]).toEqual(['u1'])
    expect(st.grid[0].night[GUARD]).toEqual(['u2'])
    expect(st.committed.u1).toEqual([{ employeeId: 'u1', day: 0, shift: 'morning', roleId: GUARD }])
    expect(st.committed.u3).toEqual([])
  })

  it('recounts granted requests from the saved rows', () => {
    const st = stateFromRows(week(), [{ employeeId: 'u1', day: 0, shiftKey: 'morning', roleName: GUARD, fills: null }])
    expect(st.satisfied).toEqual({ u1: 1, u2: 0, u3: 0 })
  })

  it('expands a 12h row into every covered window with its own role', () => {
    const st = stateFromRows(week(), [
      {
        employeeId: 'u3', day: 1, shiftKey: 'm12_day', roleName: GUARD,
        fills: [{ shift: 'morning', roleName: GUARD }, { shift: 'noon', roleName: SHIFT_MGR }],
      },
    ])
    expect(st.grid[1].morning[GUARD]).toEqual(['u3'])
    expect(st.grid[1].noon[SHIFT_MGR]).toEqual(['u3'])
    expect(st.committed.u3.every((a) => a.is12h && a.variant === 'm12_day')).toBe(true)
    expect(st.twelve).toEqual([
      { employeeId: 'u3', day: 1, variant: 'm12_day', rolesByShift: { morning: GUARD, noon: SHIFT_MGR } },
    ])
  })

  it('falls back to the variant windows for a legacy 12h row without fills', () => {
    const st = stateFromRows(week(), [{ employeeId: 'u2', day: 0, shiftKey: 'm12_day', roleName: GUARD, fills: null }])
    expect(st.grid[0].morning[GUARD]).toEqual(['u2'])
    expect(st.grid[0].noon[GUARD]).toEqual(['u2'])
  })

  it('counts a temp as an occupant but never as a swappable worker', () => {
    const st = stateFromRows(week(), [{ employeeId: null, day: 0, shiftKey: 'noon', roleName: GUARD, fills: null }])
    expect(st.grid[0].noon[GUARD]).toEqual([TEMP_OCCUPANT])
    expect(Object.keys(st.committed).sort()).toEqual(['u1', 'u2', 'u3'])
  })

  it('keeps an off-roster worker in the grid only', () => {
    const st = stateFromRows(week(), [{ employeeId: 'gone', day: 1, shiftKey: 'night', roleName: GUARD, fills: null }])
    expect(st.grid[1].night[GUARD]).toEqual(['gone'])
    expect(st.committed.gone).toBeUndefined()
  })

  it('opens a grid cell for a role the week does not require', () => {
    const st = stateFromRows(week(), [{ employeeId: 'u1', day: 1, shiftKey: 'morning', roleName: 'מוקדן', fills: null }])
    expect(st.grid[1].morning['מוקדן']).toEqual(['u1'])
  })
})
