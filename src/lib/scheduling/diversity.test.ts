// Regression suite for the coverage-preserving diversity post-pass:
//   1. Requests are NEVER sacrificed (catches the old 35→34 regression).
//   2. The pass is reorder-invariant w.r.t. input.employees order.
//   3. Single-type stranding is broken via swaps + 3-cycle rotations.
//   4. Coverage / determinism are preserved.
import { describe, it, expect } from 'vitest'
import { runFill, countFilled } from './fill'
import { runDiversityPass } from './diversity'
import { satisfiedCount, typeSpread, diversityCost } from './index'
import type { DayMeta } from './types'
import {
  GUARD,
  buildRequests,
  emp,
  input,
  mergeReqs,
  reqFor,
} from './fixtures'
import type { Assignment, EngineInput, ShiftKey } from './types'

const idsOf = (inp: EngineInput) => inp.employees.map((e) => e.id)
const spreadOf = (st: { committed: Record<string, Assignment[]> }, id: string) =>
  typeSpread(st.committed[id] ?? [])

function fullWeekReqs() {
  return mergeReqs(
    reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 1),
    reqFor([0, 1, 2, 3, 4, 5, 6], 'noon', GUARD, 1),
    reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 1),
  )
}

function guardWeek(n: number, seed = 1): EngineInput {
  const employees = Array.from({ length: n }, (_, i) => emp(String.fromCharCode(97 + i)))
  return input({ employees, requirements: fullWeekReqs(), seed })
}

const totalSatisfied = (inp: EngineInput, st: { committed: Record<string, Assignment[]> }) =>
  idsOf(inp).reduce((s, id) => s + satisfiedCount(inp, id, st.committed[id]), 0)

// ───────────────────────── 1. requests never drop ────────────────────────────
describe('diversity is request-preserving', () => {
  // A week where several guards request specific shifts that the engine grants;
  // the diversity pass must not move any of them off a granted request.
  function requestedWeek(seed = 3): EngineInput {
    const employees = Array.from({ length: 6 }, (_, i) => emp(String.fromCharCode(97 + i)))
    const want: Record<string, [number, ShiftKey][]> = {
      a: [[0, 'morning'], [2, 'night']],
      b: [[1, 'noon'], [3, 'morning']],
      c: [[4, 'night'], [5, 'noon']],
      d: [[6, 'morning']],
      e: [[2, 'noon']],
      f: [[3, 'night']],
    }
    const requests = buildRequests(employees, (id, d) => {
      const pref = (want[id] ?? []).filter(([day]) => day === d).map(([, s]) => s)
      return { preferred: pref }
    })
    return input({ employees, requirements: fullWeekReqs(), requests, seed })
  }

  it('total satisfied requests == baseline (skipDiversity) — catches 35→34', () => {
    for (const seed of [1, 2, 3, 7]) {
      const inp = requestedWeek(seed)
      const base = runFill(inp, false, true)
      const div = runFill(inp)
      expect(totalSatisfied(inp, div)).toBe(totalSatisfied(inp, base))
    }
  })

  it('no single employee loses a satisfied request (1→0 guard)', () => {
    const inp = requestedWeek(5)
    const base = runFill(inp, false, true)
    const div = runFill(inp)
    for (const id of idsOf(inp)) {
      expect(satisfiedCount(inp, id, div.committed[id])).toBeGreaterThanOrEqual(
        satisfiedCount(inp, id, base.committed[id]),
      )
    }
  })

  it('≥2 request floor is never worsened by the pass', () => {
    const inp = requestedWeek(2)
    const base = runFill(inp, false, true)
    const div = runFill(inp)
    for (const id of idsOf(inp)) {
      const b = satisfiedCount(inp, id, base.committed[id])
      const d = satisfiedCount(inp, id, div.committed[id])
      if (b >= 2) expect(d).toBeGreaterThanOrEqual(2)
    }
  })
})

// ───────────────────────── 2. reorder-invariant ──────────────────────────────
describe('diversity is reorder-invariant', () => {
  const gridKey = (st: { committed: Record<string, Assignment[]> }) => {
    const out: Record<string, string[]> = {}
    for (const id of Object.keys(st.committed)) {
      out[id] = st.committed[id]
        .map((a) => `${a.day}:${a.shift}:${a.roleId}`)
        .sort()
    }
    return JSON.stringify(out, Object.keys(out).sort())
  }

  it('reversing the employees array yields an identical grid (12 guards)', () => {
    const base = guardWeek(12, 9)
    const reversed: EngineInput = { ...base, employees: base.employees.slice().reverse() }
    expect(gridKey(runFill(reversed))).toBe(gridKey(runFill(base)))
  })

  it('shuffling the employees array yields an identical grid', () => {
    const base = guardWeek(7, 4)
    const order = [3, 0, 6, 1, 5, 2, 4]
    const shuffled: EngineInput = { ...base, employees: order.map((i) => base.employees[i]) }
    expect(gridKey(runFill(shuffled))).toBe(gridKey(runFill(base)))
  })
})

// ───────────────────────── 3. stranding broken ───────────────────────────────
describe('diversity breaks single-type stranding', () => {
  // 5 guards / 21 slots: every guard has slack (free days). An unrestricted
  // guard must NOT end stranded on one shift-type when legal moves exist.
  it('every unrestricted guard ends with type-spread ≤ 2', () => {
    const inp = guardWeek(5, 11)
    const div = runFill(inp)
    for (const id of idsOf(inp)) expect(spreadOf(div, id)).toBeLessThanOrEqual(2)
  })

  it('total type-spread improves vs the no-pass baseline (skipDiversity)', () => {
    const inp = guardWeek(5, 11)
    const base = runFill(inp, false, true)
    const div = runFill(inp)
    const sum = (st: { committed: Record<string, Assignment[]> }) =>
      idsOf(inp).reduce((s, id) => s + typeSpread(st.committed[id]), 0)
    expect(sum(div)).toBeLessThan(sum(base))
  })

  // 3-cycle rotations strictly help BEYOND single swaps. On a multi-coverage
  // week (morning×2, noon×2, night×1) run the SAME pre-pass state through
  // swap-only (maxCycle=2) vs swaps+3-cycles (maxCycle=3): the full move set is
  // always ≤ swap-only AND strictly better here (swaps reach a local optimum the
  // rotations escape). Coverage stays identical for both.
  function multiCoverWeek(n: number, seed: number): EngineInput {
    const employees = Array.from({ length: n }, (_, i) => emp(String.fromCharCode(97 + i)))
    const reqs = mergeReqs(
      reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 2),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'noon', GUARD, 2),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 1),
    )
    return input({ employees, requirements: reqs, requests: buildRequests(employees), seed })
  }

  it('swaps + 3-cycles strictly beat swaps alone on a stranding-prone week', () => {
    let improvedSomewhere = false
    for (const [n, seed] of [[6, 1], [6, 10], [7, 3]] as const) {
      const inp = multiCoverWeek(n, seed)
      const metas: Record<number, DayMeta> = {}
      for (const d of inp.days) metas[d.index] = d
      const swapOnly = runFill(inp, false, true)
      runDiversityPass(inp, swapOnly, metas, 2)
      const full = runFill(inp, false, true)
      runDiversityPass(inp, full, metas, 3)
      const cs = diversityCost(inp.employees, swapOnly.committed)
      const cf = diversityCost(inp.employees, full.committed)
      expect(cf).toBeLessThanOrEqual(cs)
      // coverage identical regardless of move set
      expect(countFilled(full)).toBe(countFilled(swapOnly))
      if (cf < cs) improvedSomewhere = true
    }
    expect(improvedSomewhere).toBe(true)
  })
})

// ───────────────────────── 4. coverage / determinism ─────────────────────────
describe('diversity preserves coverage and determinism', () => {
  it('countFilled identical with vs without the pass', () => {
    for (const n of [4, 5, 7, 12]) {
      const inp = guardWeek(n, 13)
      expect(countFilled(runFill(inp))).toBe(countFilled(runFill(inp, false, true)))
    }
  })
  it('same seed + data → identical committed', () => {
    const inp = guardWeek(8, 21)
    expect(JSON.stringify(runFill(inp).committed)).toBe(
      JSON.stringify(runFill(inp).committed),
    )
  })
  it('one shift per day holds after the pass', () => {
    const div = runFill(guardWeek(6, 3))
    for (const id of Object.keys(div.committed)) {
      const days = div.committed[id].map((a) => a.day)
      expect(new Set(days).size).toBe(days.length)
    }
  })
})
