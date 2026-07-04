// Change 2: the manager-balance post-pass gives every holder of the manager
// (top-rank) role ≥50% of their shifts IN that role, via coverage-preserving
// same-shift role swaps — never displacing a senior manager or dropping the
// donor below their own target. Tested directly on hand-built FillStates for
// determinism, plus one end-to-end invariant guard.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { runManagerBalancePass } from './manager-balance'
import { GUARD, SHIFT_MGR, emp, input, mergeReqs, reqFor } from './fixtures'
import type { FillState } from './dayfill'
import type { Assignment, DayMeta, EngineInput, ShiftKey } from './types'

interface Cell {
  emp: string
  day: number
  shift: ShiftKey
  role: string
  is12h?: boolean
}

function stateFrom(cells: Cell[], empIds: string[]): FillState {
  const st: FillState = { grid: {}, committed: {}, satisfied: {}, lotteryRank: {} }
  empIds.forEach((id, i) => {
    st.committed[id] = []
    st.satisfied[id] = 0
    st.lotteryRank[id] = i
  })
  for (const c of cells) {
    const asg: Assignment = { employeeId: c.emp, day: c.day, shift: c.shift, roleId: c.role, is12h: c.is12h }
    st.committed[c.emp].push(asg)
    const grid = st.grid[c.day] ?? (st.grid[c.day] = {} as Record<ShiftKey, Record<string, string[]>>)
    const byShift = grid[c.shift] ?? (grid[c.shift] = {})
    ;(byShift[c.role] ?? (byShift[c.role] = [])).push(c.emp)
  }
  return st
}

const metasOf = (inp: EngineInput): Record<number, DayMeta> =>
  Object.fromEntries(inp.days.map((d) => [d.index, d]))

const mgrCount = (st: FillState, id: string) =>
  st.committed[id].filter((a) => a.roleId === SHIFT_MGR).length

describe('manager-balance pass', () => {
  it('swaps a below-target manager into the manager slot held by a surplus manager', () => {
    // a & b both hold אחמ״ש+מאבטח. b hogs the manager slot both days (2/2), a is
    // stuck in guard (0/2). Each works 2 shifts → target ceil(2/2)=1. One swap
    // rebalances to 1/1 — both at 50%.
    const a = emp('a', { roleIds: [SHIFT_MGR, GUARD] })
    const b = emp('b', { roleIds: [SHIFT_MGR, GUARD] })
    const st = stateFrom(
      [
        { emp: 'a', day: 0, shift: 'morning', role: GUARD },
        { emp: 'b', day: 0, shift: 'morning', role: SHIFT_MGR },
        { emp: 'a', day: 1, shift: 'morning', role: GUARD },
        { emp: 'b', day: 1, shift: 'morning', role: SHIFT_MGR },
      ],
      ['a', 'b'],
    )
    const inp = input({ employees: [a, b], managerRoleId: SHIFT_MGR })
    runManagerBalancePass(inp, st, metasOf(inp))
    expect(mgrCount(st, 'a')).toBe(1)
    expect(mgrCount(st, 'b')).toBe(1)
  })

  it('never displaces a SENIOR manager, even if it leaves a below target', () => {
    const a = emp('a', { roleIds: [SHIFT_MGR, GUARD] })
    const b = emp('b', { roleIds: [SHIFT_MGR, GUARD], seniorRoleIds: [SHIFT_MGR] })
    const st = stateFrom(
      [
        { emp: 'a', day: 0, shift: 'morning', role: GUARD },
        { emp: 'b', day: 0, shift: 'morning', role: SHIFT_MGR },
        { emp: 'a', day: 1, shift: 'morning', role: GUARD },
        { emp: 'b', day: 1, shift: 'morning', role: SHIFT_MGR },
      ],
      ['a', 'b'],
    )
    const inp = input({ employees: [a, b], managerRoleId: SHIFT_MGR })
    runManagerBalancePass(inp, st, metasOf(inp))
    expect(mgrCount(st, 'a')).toBe(0) // senior b keeps both manager slots
    expect(mgrCount(st, 'b')).toBe(2)
  })

  it('does not drop the donor below their OWN target', () => {
    // Each works 1 shift → target 1. Swapping would push b to 0 (< target) → blocked.
    const a = emp('a', { roleIds: [SHIFT_MGR, GUARD] })
    const b = emp('b', { roleIds: [SHIFT_MGR, GUARD] })
    const st = stateFrom(
      [
        { emp: 'a', day: 0, shift: 'morning', role: GUARD },
        { emp: 'b', day: 0, shift: 'morning', role: SHIFT_MGR },
      ],
      ['a', 'b'],
    )
    const inp = input({ employees: [a, b], managerRoleId: SHIFT_MGR })
    runManagerBalancePass(inp, st, metasOf(inp))
    expect(mgrCount(st, 'a')).toBe(0)
    expect(mgrCount(st, 'b')).toBe(1)
  })

  it('is a no-op when managerRoleId is undefined', () => {
    const a = emp('a', { roleIds: [SHIFT_MGR, GUARD] })
    const b = emp('b', { roleIds: [SHIFT_MGR, GUARD] })
    const st = stateFrom(
      [
        { emp: 'a', day: 0, shift: 'morning', role: GUARD },
        { emp: 'b', day: 0, shift: 'morning', role: SHIFT_MGR },
        { emp: 'a', day: 1, shift: 'morning', role: GUARD },
        { emp: 'b', day: 1, shift: 'morning', role: SHIFT_MGR },
      ],
      ['a', 'b'],
    )
    const inp = input({ employees: [a, b] }) // managerRoleId undefined
    runManagerBalancePass(inp, st, metasOf(inp))
    expect(mgrCount(st, 'a')).toBe(0)
    expect(mgrCount(st, 'b')).toBe(2)
  })

  it('never touches 12h cells', () => {
    const a = emp('a', { roleIds: [SHIFT_MGR, GUARD] })
    const b = emp('b', { roleIds: [SHIFT_MGR, GUARD] })
    const st = stateFrom(
      [
        { emp: 'a', day: 0, shift: 'morning', role: GUARD, is12h: true },
        { emp: 'b', day: 0, shift: 'morning', role: SHIFT_MGR },
        { emp: 'a', day: 1, shift: 'morning', role: GUARD, is12h: true },
        { emp: 'b', day: 1, shift: 'morning', role: SHIFT_MGR },
      ],
      ['a', 'b'],
    )
    const inp = input({ employees: [a, b], managerRoleId: SHIFT_MGR })
    runManagerBalancePass(inp, st, metasOf(inp))
    expect(mgrCount(st, 'a')).toBe(0) // a's 12h guard cells can't be swapped
    expect(st.committed['a'].every((x) => x.is12h)).toBe(true)
  })
})

describe('manager-balance end-to-end invariant', () => {
  it('every manager-holder ends with ≥50% of their shifts in the manager role', () => {
    const a = emp('a', { roleIds: [SHIFT_MGR, GUARD] })
    const b = emp('b', { roleIds: [SHIFT_MGR, GUARD] })
    const days = [0, 1, 2, 3, 4, 5]
    const req = mergeReqs(reqFor(days, 'morning', SHIFT_MGR, 1), reqFor(days, 'morning', GUARD, 1))
    const res = generateSchedule(
      input({ employees: [a, b], requirements: req, managerRoleId: SHIFT_MGR, seed: 3 }),
    )
    for (const id of ['a', 'b']) {
      const asg = res.assignmentsByEmployee[id] ?? []
      const mgr = asg.filter((x) => x.roleId === SHIFT_MGR).length
      expect(mgr).toBeGreaterThanOrEqual(Math.ceil(asg.length / 2))
    }
  })
})
