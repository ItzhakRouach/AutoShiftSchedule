// Block swap: two workers exchange ALL their 8h shifts on a run of consecutive
// days. A single night↔day swap is often blocked by rest (a night followed by
// the receiver's next-morning shift); exchanging the next day too carries the
// rest pattern along with the shifts, so the night can still change hands.
import { describe, it, expect } from 'vitest'
import { tryBlockSwap } from './block-swap'
import { emptyGrid } from './grid'
import type { FillState } from './dayfill'
import { GUARD, buildRequests, emp, input } from './fixtures'
import type { EngineInput, ShiftKey } from './types'
import { nightCount } from './fairness'

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

describe('tryBlockSwap', () => {
  it('moves a night when the plain swap would break rest', () => {
    // g: nights d1 and d4 (two more than r). r: noon d1, morning d2. Swapping
    // only d1 would put r on a night ending 07:00 d2 straight into their 07:00
    // morning — illegal. Swapping d1+d2: g takes noon d1 + morning d2, r takes
    // night d1.
    const inp = input({ employees: [emp('g'), emp('r')] })
    const st = stateWith(inp, [['g', 1, 'night'], ['g', 4, 'night'], ['r', 1, 'noon'], ['r', 2, 'morning']])
    expect(tryBlockSwap(inp, metasOf(inp), st, 'g', 'r', 1)).toBe(true)
    expect(nightCount(st.committed.g)).toBe(1)
    expect(nightCount(st.committed.r)).toBe(1)
    expect(st.grid[1].night[GUARD]).toEqual(['r'])
    expect(st.grid[1].noon[GUARD]).toEqual(['g'])
    expect(st.grid[2].morning[GUARD]).toEqual(['g'])
  })

  it('never strips a granted request', () => {
    const employees = [emp('g'), emp('r')]
    const inp = input({ employees, requests: buildRequests(employees, (id, d) => (id === 'r' && d === 2 ? { preferred: ['morning'] } : {})) })
    const st = stateWith(inp, [['g', 1, 'night'], ['g', 4, 'night'], ['r', 1, 'noon'], ['r', 2, 'morning']])
    st.satisfied.r = 1
    expect(tryBlockSwap(inp, metasOf(inp), st, 'g', 'r', 1)).toBe(false)
    expect(st.grid[1].night[GUARD]).toEqual(['g'])
  })

  it('respects the receiver being off on a day of the block', () => {
    const employees = [emp('g'), emp('r')]
    const inp = input({ employees, requests: buildRequests(employees, (id, d) => (id === 'r' && d === 0 ? { off: true } : {})) })
    // g: morning d0, night d1; r: noon d1, morning d2. Blocks containing d0 would
    // hand r g's morning on their day off — only the d1+d2 block is allowed.
    const st = stateWith(inp, [['g', 0, 'morning'], ['g', 1, 'night'], ['g', 4, 'night'], ['r', 1, 'noon'], ['r', 2, 'morning']])
    expect(tryBlockSwap(inp, metasOf(inp), st, 'g', 'r', 1)).toBe(true)
    expect(st.committed.r.some((a) => a.day === 0)).toBe(false)
  })
})
