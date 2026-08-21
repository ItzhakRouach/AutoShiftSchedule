// Unit tests for the NIGHT-EVENNESS pass over hand-built FillStates (the
// integration expectations live in night-evenness.test.ts).
import { describe, it, expect } from 'vitest'
import { runNightEvennessPass } from './night-evenness'
import { runFill } from './fill'
import { emptyGrid } from './grid'
import { nightCount } from './fairness'
import { buildNightThresholds } from './night-targets'
import type { FillState } from './dayfill'
import { GUARD, buildRequests, emp, input, reqFor } from './fixtures'
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
const countsOf = (st: FillState, ids: string[]) => ids.map((id) => nightCount(st.committed[id]))

describe('runNightEvennessPass', () => {
  it('U1: evens a 2/2/0 split that night-unload ignores (all under cap)', () => {
    const employees = [emp('a'), emp('b'), emp('c')]
    const inp = input({ employees, requirements: reqFor([0, 1, 2, 3], 'night', GUARD, 1) })
    const st = stateWith(inp, [
      ['a', 0, 'night'], ['a', 2, 'night'], ['a', 4, 'morning'],
      ['b', 1, 'night'], ['b', 3, 'night'], ['b', 5, 'morning'],
      ['c', 0, 'morning'], ['c', 1, 'noon'], ['c', 2, 'morning'],
    ])
    const thresholds = buildNightThresholds(inp) // T = ceil(4/3) = 2 each
    const gridSizes = JSON.stringify(
      inp.days.map((d) => (['morning', 'noon', 'night'] as ShiftKey[]).map((s) => st.grid[d.index][s][GUARD].length)),
    )

    runNightEvennessPass(inp, st, metasOf(inp), thresholds)

    expect(countsOf(st, ['a', 'b', 'c'])).toEqual([1, 2, 1])
    expect(countsOf(st, ['a', 'b', 'c']).reduce((s, n) => s + n, 0)).toBe(4)
    // Coverage-preserving: every grid cell keeps its size.
    expect(
      JSON.stringify(
        inp.days.map((d) => (['morning', 'noon', 'night'] as ShiftKey[]).map((s) => st.grid[d.index][s][GUARD].length)),
      ),
    ).toBe(gridSizes)
  })

  it('U2: requested nights never move — pass falls through to the next giver', () => {
    const employees = [emp('a'), emp('b'), emp('c')]
    const requests = buildRequests(employees, (id, day) =>
      id === 'a' && (day === 0 || day === 2) ? { preferred: ['night'] } : {},
    )
    const inp = input({ employees, requests, requirements: reqFor([0, 1, 2, 3], 'night', GUARD, 1) })
    const st = stateWith(inp, [
      ['a', 0, 'night'], ['a', 2, 'night'], ['a', 4, 'morning'],
      ['b', 1, 'night'], ['b', 3, 'night'], ['b', 5, 'morning'],
      ['c', 0, 'morning'], ['c', 1, 'noon'], ['c', 2, 'morning'],
    ])
    st.satisfied['a'] = 2

    runNightEvennessPass(inp, st, metasOf(inp), { a: 2, b: 2, c: 2 })

    // a keeps BOTH requested nights; b donated one instead (n3 ↔ c's m0 is the
    // only rest-legal exchange — n1 swaps all collide with 0h rest gaps).
    const aNights = st.committed['a'].filter((x) => x.shift === 'night').map((x) => x.day)
    expect(aNights.sort()).toEqual([0, 2])
    expect(countsOf(st, ['a', 'b', 'c'])).toEqual([2, 1, 1])
  })

  it('U3: no legal swap exists → state unchanged and the pass terminates', () => {
    const employees = [emp('t'), emp('n')]
    const inp = input({ employees, requirements: reqFor([0, 1], 'night', GUARD, 1) })
    const st = stateWith(inp, [
      ['t', 0, 'morning'], ['t', 1, 'morning'],
      ['n', 0, 'night'], ['n', 1, 'night'],
    ])
    const before = JSON.stringify(st.committed)

    runNightEvennessPass(inp, st, metasOf(inp), buildNightThresholds(inp))

    expect(JSON.stringify(st.committed)).toBe(before)
  })

  it('U4: a receiver at their night cap is skipped', () => {
    const employees = [emp('a'), emp('b'), emp('c')]
    const inp = input({ employees, requirements: reqFor([0, 2, 4], 'night', GUARD, 1) })
    const st = stateWith(inp, [
      ['a', 0, 'night'], ['a', 2, 'night'], ['a', 4, 'night'],
      ['b', 0, 'morning'],
      ['c', 1, 'morning'],
    ])

    runNightEvennessPass(inp, st, metasOf(inp), { a: 3, b: 0, c: 3 })

    // b (cap 0) may not receive; c takes one night instead. a stays 2 vs b 0 —
    // best-effort: no further legal improvement.
    expect(countsOf(st, ['a', 'b', 'c'])).toEqual([2, 0, 1])
  })

  it('U5: Infinity-exempt (night-only) workers are outside the pool both ways', () => {
    const employees = [emp('x'), emp('a')]
    const inp = input({ employees, requirements: reqFor([0, 1, 2, 3, 4], 'night', GUARD, 1) })
    const st = stateWith(inp, [
      ['x', 0, 'night'], ['x', 1, 'night'], ['x', 2, 'night'], ['x', 3, 'night'], ['x', 4, 'night'],
      ['a', 0, 'morning'],
    ])
    const before = JSON.stringify(st.committed)

    runNightEvennessPass(inp, st, metasOf(inp), { x: Infinity, a: 3 })

    expect(JSON.stringify(st.committed)).toBe(before)
  })
})

describe('wiring', () => {
  it('runFill runs the night-evenness pass (timings entry present)', () => {
    const employees = [emp('a'), emp('b')]
    const inp = input({
      employees,
      requirements: reqFor([0, 1], 'night', GUARD, 1),
      collectTimings: true,
    })
    const st = runFill(inp)
    expect(Object.keys(st.timings ?? {})).toContain('night-evenness')
  })
})
