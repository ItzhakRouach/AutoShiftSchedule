import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { runFill, countFilled } from './fill'
import { fairnessScore, typeSpread, unpopularLoad, byType, diversityCost } from './index'
import {
  GUARD,
  buildRequests,
  emp,
  input,
  mergeReqs,
  reqFor,
} from './fixtures'
import type { Assignment, EngineInput, ShiftKey } from './types'

const A = (day: number, shift: ShiftKey): Assignment => ({
  employeeId: 'x',
  day,
  shift,
  roleId: GUARD,
})

const spreadOf = (bt: { morning: number; noon: number; night: number }) =>
  Math.max(bt.morning, bt.noon, bt.night) - Math.min(bt.morning, bt.noon, bt.night)

// ───────────────────────── unit: fairness primitives ─────────────────────────
describe('fairness primitives', () => {
  it('byType counts each shift type', () => {
    expect(byType([A(0, 'morning'), A(1, 'morning'), A(2, 'night')])).toEqual({
      morning: 2,
      noon: 0,
      night: 1,
    })
  })
  it('typeSpread is max−min of by-type counts (0 when even)', () => {
    expect(typeSpread([A(0, 'morning'), A(1, 'noon'), A(2, 'night')])).toBe(0)
    expect(typeSpread([A(0, 'morning'), A(1, 'morning'), A(2, 'morning')])).toBe(3)
  })
  it('unpopularLoad counts nights + Fri(5)/Sat(6) shifts', () => {
    expect(unpopularLoad([A(0, 'morning'), A(3, 'night'), A(5, 'morning'), A(6, 'noon')])).toBe(3)
  })
  it('fairnessScore: load dominates unpopular and spread', () => {
    const heavyButNice = [A(0, 'morning'), A(1, 'noon'), A(2, 'night'), A(3, 'morning')]
    const lightButNasty = [A(5, 'night'), A(6, 'night'), A(4, 'night')]
    expect(fairnessScore(lightButNasty)).toBeLessThan(fairnessScore(heavyButNice))
  })
})

// Crafted weeks: N guards, full morning+noon+night every day (21 slots). With
// N ≥ 4 each guard has free days, giving the coverage-preserving swap pass room.
function guardWeek(n: number, seed = 1): EngineInput {
  const employees = Array.from({ length: n }, (_, i) => emp(String.fromCharCode(97 + i)))
  const reqs = mergeReqs(
    reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 1),
    reqFor([0, 1, 2, 3, 4, 5, 6], 'noon', GUARD, 1),
    reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 1),
  )
  return input({ employees, requirements: reqs, seed })
}
const idsOf = (inp: EngineInput) => inp.employees.map((e) => e.id)

// ───────────────────────── even shift-count distribution (dim 1) ─────────────
describe('even shift-count distribution', () => {
  it('21 slots / 3 guards → 7 each (no 7-vs-3)', () => {
    const res = generateSchedule(guardWeek(3))
    const counts = idsOf(guardWeek(3)).map((id) => res.stats[id].shifts)
    expect(counts.every((c) => c === 7)).toBe(true)
  })
  it('21 slots / 5 guards → spread ≤ 1 (4 or 5 each, no pileup)', () => {
    const inp = guardWeek(5)
    const res = generateSchedule(inp)
    const counts = idsOf(inp).map((id) => res.stats[id].shifts)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })
})

// ───────────────────────── shift-type variety (dim 2) ────────────────────────
describe('shift-type variety per employee', () => {
  it('every flexible guard is spread across types (spread ≤ 1), not stranded', () => {
    const inp = guardWeek(5)
    const res = generateSchedule(inp)
    for (const id of idsOf(inp)) expect(spreadOf(res.stats[id].byType)).toBeLessThanOrEqual(1)
  })
  it('diversity pass improves total type-spread vs. the pre-pass baseline', () => {
    const inp = guardWeek(4)
    const before = runFill(inp, false, true) // skipDiversity = true
    const after = runFill(inp)
    const sum = (st: { committed: Record<string, Assignment[]> }) =>
      idsOf(inp).reduce((s, id) => s + typeSpread(st.committed[id]), 0)
    expect(sum(after)).toBeLessThanOrEqual(sum(before))
  })
})

// ───────────────────────── night/weekend balance (dim 3) ─────────────────────
describe('night/weekend fairness', () => {
  it('night+weekend load spread across guards is bounded (≤ 1)', () => {
    const inp = guardWeek(5)
    const res = generateSchedule(inp)
    const loads = idsOf(inp).map((id) => unpopularLoad(res.stats[id].assignments))
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1)
  })
})

// ───────────────────────── co-worker rotation (dim 4) ────────────────────────
describe('co-worker rotation', () => {
  it('diversity cost (type-spread + repeated pairings) is ≤ the pre-pass baseline', () => {
    for (const n of [4, 5]) {
      const inp = guardWeek(n)
      const before = diversityCost(inp.employees, runFill(inp, false, true).committed)
      const after = diversityCost(inp.employees, runFill(inp).committed)
      expect(after).toBeLessThanOrEqual(before)
    }
  })
})

// ───────────────────── no coverage regression (critical) ─────────────────────
describe('no coverage regression', () => {
  it('coverage is identical with and without the diversity pass', () => {
    for (const n of [3, 4, 5]) {
      const inp = guardWeek(n)
      expect(countFilled(runFill(inp))).toBe(countFilled(runFill(inp, false, true)))
    }
  })
  it('fully-staffable week stays 100%', () => {
    const res = generateSchedule(guardWeek(3))
    expect(res.coverage.percent).toBe(100)
    expect(res.warnings).toHaveLength(0)
  })
  it('hard constraints hold after the diversity pass (≤1 shift/day, role)', () => {
    const inp = guardWeek(5)
    const res = generateSchedule(inp)
    for (const id of idsOf(inp)) {
      const days = res.stats[id].assignments.map((x) => x.day)
      expect(new Set(days).size).toBe(days.length)
      expect(res.stats[id].assignments.every((x) => x.roleId === GUARD)).toBe(true)
    }
  })
  it('off-request stays honored after the diversity pass', () => {
    const employees = [emp('a'), emp('b'), emp('c'), emp('d')]
    const reqs = mergeReqs(
      reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 1),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'noon', GUARD, 1),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 1),
    )
    const requests = buildRequests(employees, (id, d) => (id === 'a' && d === 3 ? { off: true } : {}))
    const res = generateSchedule(input({ employees, requirements: reqs, requests }))
    expect(res.stats['a'].assignments.some((x) => x.day === 3)).toBe(false)
  })
  it('determinism: same seed+input → identical output', () => {
    const a = generateSchedule(guardWeek(5, 7))
    const b = generateSchedule(guardWeek(5, 7))
    expect(JSON.stringify(a.assignmentsByEmployee)).toBe(JSON.stringify(b.assignmentsByEmployee))
  })
})
