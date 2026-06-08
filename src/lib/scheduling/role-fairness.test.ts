import { describe, it, expect } from 'vitest'
import { runFill } from './fill'
import { roleSplitCost } from './diversity'
import { emp, input, reqFor, mergeReqs, GUARD, SHIFT_MGR } from './fixtures'
import type { Assignment } from './types'

const a = (day: number, shift: 'morning' | 'noon' | 'night', roleId: string): Assignment => ({
  employeeId: 'x',
  day,
  shift,
  roleId,
})

describe('senior preference within a role', () => {
  it('a senior holder gets the role shift over a regular holder', () => {
    const senior = emp('senior', { roleIds: [SHIFT_MGR], seniorRoleIds: [SHIFT_MGR] })
    const regular = emp('regular', { roleIds: [SHIFT_MGR] })
    const inp = input({
      employees: [senior, regular],
      requirements: reqFor([0], 'morning', SHIFT_MGR, 1),
    })
    const st = runFill(inp)
    expect(st.committed['senior'].length).toBe(1)
    expect(st.committed['regular'].length).toBe(0)
  })

  it('seniors are favored but regulars still fill what seniors cannot cover', () => {
    // 1 senior + 2 regulars, 3 Akhmash shifts on distinct days. The senior can
    // only work one shift/day, so regulars MUST cover the other two.
    const senior = emp('senior', { roleIds: [SHIFT_MGR], seniorRoleIds: [SHIFT_MGR] })
    const r1 = emp('r1', { roleIds: [SHIFT_MGR] })
    const r2 = emp('r2', { roleIds: [SHIFT_MGR] })
    const inp = input({
      employees: [senior, r1, r2],
      requirements: mergeReqs(reqFor([0, 1, 2], 'morning', SHIFT_MGR, 1)),
    })
    const st = runFill(inp)
    const total = st.committed['senior'].length + st.committed['r1'].length + st.committed['r2'].length
    expect(total).toBe(3) // full coverage preserved
    expect(st.committed['senior'].length).toBeGreaterThanOrEqual(1) // senior is used
  })
})

describe('even split within a single role (existing load fairness)', () => {
  it('splits a role evenly across its holders', () => {
    const emps = ['a', 'b', 'c'].map((id) => emp(id, { roleIds: [SHIFT_MGR] }))
    const inp = input({
      employees: emps,
      requirements: mergeReqs(reqFor([0, 1, 2], 'morning', SHIFT_MGR, 1)),
    })
    const st = runFill(inp)
    for (const id of ['a', 'b', 'c']) expect(st.committed[id].length).toBe(1)
  })
})

describe('roleSplitCost', () => {
  it('is 0 when a role is evenly split', () => {
    const x = emp('x', { roleIds: [SHIFT_MGR] })
    const y = emp('y', { roleIds: [SHIFT_MGR] })
    const committed = {
      x: [a(0, 'morning', SHIFT_MGR)],
      y: [a(1, 'morning', SHIFT_MGR)],
    }
    expect(roleSplitCost([x, y], committed)).toBe(0)
  })

  it('penalises an uneven role distribution', () => {
    const x = emp('x', { roleIds: [SHIFT_MGR, GUARD] })
    const y = emp('y', { roleIds: [SHIFT_MGR] })
    const committed = {
      x: [a(0, 'morning', SHIFT_MGR), a(1, 'noon', SHIFT_MGR)],
      y: [] as Assignment[],
    }
    // SHIFT_MGR holders x,y → counts 2,0 → spread 2. GUARD has a single holder → skipped.
    expect(roleSplitCost([x, y], committed)).toBe(2)
  })

  it('ignores roles with fewer than two holders', () => {
    const x = emp('x', { roleIds: [GUARD] })
    const committed = { x: [a(0, 'morning', GUARD), a(1, 'noon', GUARD)] }
    expect(roleSplitCost([x], committed)).toBe(0)
  })
})
