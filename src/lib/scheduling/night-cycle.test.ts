import { describe, it, expect } from 'vitest'
import { tryNightCycle } from './night-cycle'
import { emptyGrid } from './grid'
import type { FillState } from './dayfill'
import { GUARD, emp, input } from './fixtures'
import type { EngineInput, ShiftKey } from './types'
import { nightCount } from './fairness'

function stateWith(inp: EngineInput, cells: Array<[string, number, ShiftKey]>): FillState {
  const st: FillState = { grid: emptyGrid(inp), committed: {}, satisfied: {}, lotteryRank: {} }
  for (const e of inp.employees) { st.committed[e.id] = []; st.satisfied[e.id] = 0; st.lotteryRank[e.id] = 0 }
  for (const [id, day, shift] of cells) {
    st.grid[day][shift][GUARD].push(id)
    st.committed[id].push({ employeeId: id, day, shift, roleId: GUARD })
  }
  return st
}
const metasOf = (inp: EngineInput) => Object.fromEntries(inp.days.map((d) => [d.index, d]))

describe('tryNightCycle', () => {
  it('a third worker makes room when no direct swap is possible', () => {
    // g (noon/night only) has two nights; r (max 2 shifts) has two mornings g
    // cannot take, so no direct or block swap works. Rotation: r takes g's
    // Monday night, g takes x's Monday noon, x takes one of r's mornings.
    const nightsOnly = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, ['noon', 'night'] as ShiftKey[]]))
    const inp = input({ employees: [emp('g', { availability: nightsOnly }), emp('r', { maxShifts: 2 }), emp('x')] })
    const st = stateWith(inp, [['g', 1, 'night'], ['g', 4, 'night'], ['r', 3, 'morning'], ['r', 5, 'morning'], ['x', 1, 'noon']])
    expect(tryNightCycle(inp, metasOf(inp), st, 'g', 'r')).toBe(true)
    expect(nightCount(st.committed.g)).toBe(1)
    expect(nightCount(st.committed.r)).toBe(1)
    expect(st.grid[1].night[GUARD]).toEqual(['r'])
    expect(st.grid[1].noon[GUARD]).toEqual(['g'])
    expect(st.committed.x.map((a) => a.shift)).toEqual(['morning'])
    expect(st.committed.r).toHaveLength(2)
  })

  it('leaves a night the giver asked for alone', () => {
    const inp = input({ employees: [emp('g'), emp('r', { maxShifts: 2 }), emp('x')] })
    inp.requests.g[1] = { off: false, preferred: ['night'] }
    inp.requests.g[4] = { off: false, preferred: ['night'] }
    const st = stateWith(inp, [['g', 1, 'night'], ['g', 4, 'night'], ['r', 3, 'morning'], ['r', 5, 'morning'], ['x', 1, 'noon']])
    expect(tryNightCycle(inp, metasOf(inp), st, 'g', 'r')).toBe(false)
  })
})
