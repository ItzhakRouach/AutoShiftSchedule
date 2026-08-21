// moveLegal's soft-off relaxation: a SOFT off may be overridden only for
// SAME-day moves, and never at the cost of a satisfied request.
import { describe, it, expect } from 'vitest'
import { moveLegal, type Move } from './moves'
import { emptyGrid } from './grid'
import type { FillState } from './dayfill'
import { GUARD, buildRequests, emp, input } from './fixtures'
import type { EngineInput, ShiftKey } from './types'

function stateWith(inp: EngineInput, cells: Array<[string, number, ShiftKey]>): FillState {
  const st: FillState = { grid: emptyGrid(inp), committed: {}, satisfied: {}, lotteryRank: {} }
  for (const e of inp.employees) {
    st.committed[e.id] = []
    st.satisfied[e.id] = 0
    st.lotteryRank[e.id] = 0
  }
  for (const [id, day, shift] of cells) {
    st.grid[day][shift][GUARD].push(id)
    st.committed[id].push({ employeeId: id, day, shift, roleId: GUARD })
  }
  return st
}

const metasOf = (inp: EngineInput) => Object.fromEntries(inp.days.map((d) => [d.index, d]))

const swap = (st: FillState, a: string, b: string): Move => ({
  legs: [
    { empId: a, idx: 0, a: st.committed[a][0] },
    { empId: b, idx: 0, a: st.committed[b][0] },
  ],
})

describe('moveLegal soft-off semantics', () => {
  it('mixed request (off + preferred): a same-day swap may not strip the preferred shift', () => {
    // a asked "off, but morning is OK" on day 0 and holds that morning
    // (satisfied). Swapping him to noon the same day would strip the request —
    // the request gate must reject even though the soft off is overridable.
    const employees = [emp('a'), emp('b')]
    const requests = buildRequests(employees, (id, day) =>
      id === 'a' && day === 0 ? { off: true, preferred: ['morning'] } : {},
    )
    const inp = input({ employees, requests })
    const st = stateWith(inp, [
      ['a', 0, 'morning'],
      ['b', 0, 'noon'],
    ])
    st.satisfied['a'] = 1
    expect(moveLegal(inp, metasOf(inp), st, swap(st, 'a', 'b'))).toBe(false)
  })

  it('plain soft off: same-day swap allowed (already working), cross-day swap blocked', () => {
    const employees = [emp('a'), emp('b')]
    const requests = buildRequests(employees, (id, day) =>
      id === 'a' && (day === 0 || day === 2) ? { off: true } : {},
    )
    const inp = input({ employees, requests })
    // a was (legitimately, e.g. via rescue) placed on his soft-off day 0.
    const sameDay = stateWith(inp, [
      ['a', 0, 'morning'],
      ['b', 0, 'noon'],
    ])
    expect(moveLegal(inp, metasOf(inp), sameDay, swap(sameDay, 'a', 'b'))).toBe(true)
    // A cross-day swap would ADD work on soft-off day 2 → still blocked.
    const crossDay = stateWith(inp, [
      ['a', 4, 'morning'],
      ['b', 2, 'morning'],
    ])
    expect(moveLegal(inp, metasOf(inp), crossDay, swap(crossDay, 'a', 'b'))).toBe(false)
  })

  it('offHard (vacation) is never overridden, even same-day', () => {
    const employees = [emp('a'), emp('b')]
    const requests = buildRequests(employees, (id, day) =>
      id === 'a' && day === 0 ? { offHard: true } : {},
    )
    const inp = input({ employees, requests })
    const st = stateWith(inp, [
      ['a', 0, 'morning'],
      ['b', 0, 'noon'],
    ])
    expect(moveLegal(inp, metasOf(inp), st, swap(st, 'a', 'b'))).toBe(false)
  })
})
