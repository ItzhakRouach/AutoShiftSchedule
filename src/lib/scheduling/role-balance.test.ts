// ROLE-BALANCE pass: each non-manager role's shifts split evenly across its
// holders via same-shift role swaps (the diversity pass cannot do these — its
// move shape bans same-day cells — and manager-balance only covers the manager
// role's own ≥50% ratio).
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { runRoleBalancePass } from './role-balance'
import { DISPATCH, GUARD, SHIFT_MGR, emp, input, mergeReqs, reqFor } from './fixtures'
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

const roleCount = (st: FillState, id: string, role: string) =>
  st.committed[id].filter((a) => a.roleId === role).length

describe('role-balance pass (unit)', () => {
  const dual = (id: string) => emp(id, { roleIds: [DISPATCH, GUARD] })

  it('U1: splits a 2/0 dispatch pile via same-shift role swaps', () => {
    const inp = input({ employees: [dual('d1'), dual('d2')] })
    const st = stateFrom(
      [
        { emp: 'd1', day: 0, shift: 'morning', role: DISPATCH },
        { emp: 'd1', day: 1, shift: 'morning', role: DISPATCH },
        { emp: 'd2', day: 0, shift: 'morning', role: GUARD },
        { emp: 'd2', day: 1, shift: 'morning', role: GUARD },
      ],
      ['d1', 'd2'],
    )
    runRoleBalancePass(inp, st, metasOf(inp))
    expect(roleCount(st, 'd1', DISPATCH)).toBe(1)
    expect(roleCount(st, 'd2', DISPATCH)).toBe(1)
    expect(roleCount(st, 'd1', GUARD)).toBe(1)
    expect(roleCount(st, 'd2', GUARD)).toBe(1)
  })

  it('U2: a senior holder of the role is never the giver', () => {
    const senior = emp('d1', { roleIds: [DISPATCH, GUARD], seniorRoleIds: [DISPATCH] })
    const inp = input({ employees: [senior, dual('d2')] })
    const st = stateFrom(
      [
        { emp: 'd1', day: 0, shift: 'morning', role: DISPATCH },
        { emp: 'd1', day: 1, shift: 'morning', role: DISPATCH },
        { emp: 'd2', day: 0, shift: 'morning', role: GUARD },
        { emp: 'd2', day: 1, shift: 'morning', role: GUARD },
      ],
      ['d1', 'd2'],
    )
    const before = JSON.stringify(st.committed)
    runRoleBalancePass(inp, st, metasOf(inp))
    expect(JSON.stringify(st.committed)).toBe(before)
  })

  it('U3: gap of 1 is already even — no swap', () => {
    const inp = input({ employees: [dual('d1'), dual('d2')] })
    const st = stateFrom(
      [
        { emp: 'd1', day: 0, shift: 'morning', role: DISPATCH },
        { emp: 'd2', day: 0, shift: 'morning', role: GUARD },
      ],
      ['d1', 'd2'],
    )
    const before = JSON.stringify(st.committed)
    runRoleBalancePass(inp, st, metasOf(inp))
    expect(JSON.stringify(st.committed)).toBe(before)
  })

  it('U4: manager-role cells are never used as a swap leg', () => {
    const both = (id: string) => emp(id, { roleIds: [SHIFT_MGR, GUARD] })
    const inp = input({ employees: [both('a'), both('b')], managerRoleId: SHIFT_MGR })
    const st = stateFrom(
      [
        { emp: 'a', day: 0, shift: 'morning', role: GUARD },
        { emp: 'a', day: 1, shift: 'morning', role: GUARD },
        { emp: 'b', day: 0, shift: 'morning', role: SHIFT_MGR },
        { emp: 'b', day: 1, shift: 'morning', role: SHIFT_MGR },
      ],
      ['a', 'b'],
    )
    const before = JSON.stringify(st.committed)
    runRoleBalancePass(inp, st, metasOf(inp))
    // GUARD is piled 2/0 on `a`, but the only same-shift counterpart cells are
    // manager cells — the ≥50% rule owns those, so nothing may move.
    expect(JSON.stringify(st.committed)).toBe(before)
  })

  it('U6: 12h cells are invisible — not counted and never swapped', () => {
    const inp = input({ employees: [dual('d1'), dual('d2')] })
    // d1's dispatch "pile" is all 12h coverage; only plain-8h cells count, so
    // there is no gap and nothing may move.
    const st = stateFrom(
      [
        { emp: 'd1', day: 0, shift: 'noon', role: DISPATCH, is12h: true },
        { emp: 'd1', day: 0, shift: 'night', role: DISPATCH, is12h: true },
        { emp: 'd2', day: 0, shift: 'morning', role: GUARD },
      ],
      ['d1', 'd2'],
    )
    const before = JSON.stringify(st.committed)
    runRoleBalancePass(inp, st, metasOf(inp))
    expect(JSON.stringify(st.committed)).toBe(before)
  })

  it('U5: a swap that merely shuffles the pile into the OTHER role is rejected', () => {
    const inp = input({ employees: [dual('d1'), dual('d2')] })
    // Fixing dispatch 2/0 here would push guard from 3/2 to 4/1 — net worse.
    const st = stateFrom(
      [
        { emp: 'd1', day: 0, shift: 'morning', role: DISPATCH },
        { emp: 'd1', day: 1, shift: 'morning', role: DISPATCH },
        { emp: 'd1', day: 2, shift: 'morning', role: GUARD },
        { emp: 'd1', day: 3, shift: 'morning', role: GUARD },
        { emp: 'd1', day: 4, shift: 'morning', role: GUARD },
        { emp: 'd2', day: 0, shift: 'morning', role: GUARD },
        { emp: 'd2', day: 1, shift: 'morning', role: GUARD },
      ],
      ['d1', 'd2'],
    )
    const before = JSON.stringify(st.committed)
    runRoleBalancePass(inp, st, metasOf(inp))
    expect(JSON.stringify(st.committed)).toBe(before)
  })
})

describe('role-balance end-to-end', () => {
  it('two dual-role workers split each role evenly across the week', () => {
    for (const seed of [1, 2, 3]) {
      const employees = [
        emp('d1', { roleIds: [DISPATCH, GUARD] }),
        emp('d2', { roleIds: [DISPATCH, GUARD] }),
      ]
      const req = mergeReqs(
        reqFor([0, 1, 2, 3, 4, 5], 'morning', DISPATCH, 1),
        reqFor([0, 1, 2, 3, 4, 5], 'morning', GUARD, 1),
      )
      const res = generateSchedule(input({ employees, requirements: req, seed }))
      for (const id of ['d1', 'd2']) {
        const dispatch = (res.assignmentsByEmployee[id] ?? []).filter((x) => x.roleId === DISPATCH).length
        expect(dispatch, `seed ${seed}: ${id} dispatch=${dispatch}`).toBe(3)
      }
    }
  })
})
