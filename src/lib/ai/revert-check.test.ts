import { describe, it, expect } from 'vitest'
import { revertLegal } from './revert-check'
import { stateFromRows } from './state-from-rows'
import { emp, input, reqFor, mergeReqs, GUARD } from '@/lib/scheduling/fixtures'

const week = () =>
  input({
    employees: [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })],
    requirements: mergeReqs(reqFor([0, 1, 2], 'morning', GUARD, 1), reqFor([0, 1], 'night', GUARD, 1)),
  })

const row = (employeeId: string, day: number, shiftKey: string) => ({ employeeId, day, shiftKey, roleName: GUARD, fills: null })
const side = (employeeId: string, day: number, shift: 'morning' | 'night') => ({ employeeId, day, shift, role: GUARD })

describe('revertLegal', () => {
  it('allows putting two morning workers back', () => {
    const i = week()
    // After the AI: u2 on Sun morning, u1 on Tue morning. Revert crosses them back.
    const st = stateFromRows(i, [row('u2', 0, 'morning'), row('u1', 2, 'morning')])
    expect(revertLegal(i, st, [{ a: side('u2', 0, 'morning'), b: side('u1', 2, 'morning') }])).toBe(true)
    expect(st.grid[0].morning[GUARD]).toEqual(['u1'])
  })

  it('refuses when an edit since would break rest', () => {
    const i = week()
    // Since the AI ran, the manager put u1 on Sunday night (ends Mon 07:00).
    // Reverting would put u1 back on Monday morning at 07:00 — zero rest.
    const st = stateFromRows(i, [row('u2', 1, 'morning'), row('u1', 2, 'morning'), row('u1', 0, 'night')])
    expect(revertLegal(i, st, [{ a: side('u2', 1, 'morning'), b: side('u1', 2, 'morning') }])).toBe(false)
  })

  it('refuses to move a 12h block', () => {
    const i = week()
    const st = stateFromRows(i, [row('u2', 0, 'm12_day'), row('u1', 2, 'morning')])
    expect(revertLegal(i, st, [{ a: side('u2', 0, 'morning'), b: side('u1', 2, 'morning') }])).toBe(false)
  })
})
