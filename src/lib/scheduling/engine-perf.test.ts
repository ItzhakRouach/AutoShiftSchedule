// Baseline 2026-07-02 on dev machine: ~106ms median for 20 emp × 63 slots
// (5-run range ~104-127ms; first run includes JIT warmup). Far below the
// 2000ms tripwire — see the console.log in the test below for raw per-run
// numbers on any given run.
//
// C1: a synthetic-but-realistic engine benchmark (20 employees, 3 roles, 7
// days × 3 base shifts, ~63 role-slots) used as a regression tripwire for the
// pure engine's wall time. NOT a tuning target — see docs pointer in the task
// brief. Also asserts determinism: two runs of the SAME seed produce a
// deeply-equal grid/assignments/stats (the C3 optimization task, if any, must
// preserve this).
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import {
  DISPATCH,
  GUARD,
  SHIFT_MGR,
  buildRequests,
  emp,
  input,
  mergeReqs,
  plainWeek,
  reqFor,
  E,
} from './fixtures'
import { BASE_SHIFTS } from './types'
import type { Employee, EngineInput, ShiftKey } from './types'

const ROLES = [GUARD, DISPATCH, SHIFT_MGR]
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** 20 employees spanning both employment types, availability profiles,
 *  Shabbat/holiday observance, must-accept, and senior-role holders — a
 *  realistic mixed roster rather than a uniform/trivial one. */
function buildEmployees(): Employee[] {
  const employees: Employee[] = []
  for (let i = 0; i < 20; i++) {
    const roleIds = [ROLES[i % 3], ROLES[(i + 1) % 3]] // each covers 2 of the 3 roles
    const employmentType = E[i % 4 === 0 ? 'part' : i % 7 === 0 ? 'student' : 'full']
    employees.push(
      emp(`e${i}`, {
        roleIds,
        employmentType,
        minShifts: employmentType === 'full' ? 4 : 2,
        maxShifts: employmentType === 'full' ? 6 : 3,
        observesShabbat: i % 5 === 0,
        observesHolidays: i % 6 === 0,
        mustAccept: i === 0 || i === 10,
        seniorRoleIds: i % 8 === 0 ? [roleIds[0]] : undefined,
        // A few employees have restricted availability (nights-only / no-nights).
        availability:
          i % 9 === 0
            ? { 0: ['night'], 1: ['night'], 2: ['night'], 3: ['night'], 4: ['night'] }
            : i % 11 === 0
              ? {
                  0: ['morning', 'noon'],
                  1: ['morning', 'noon'],
                  2: ['morning', 'noon'],
                  3: ['morning', 'noon'],
                  4: ['morning', 'noon'],
                  5: ['morning', 'noon'],
                  6: ['morning', 'noon'],
                }
              : null,
        priorDeficit: i % 4 === 1 ? 2 : 0,
        priorExtras: i % 4 === 2 ? 1 : 0,
      }),
    )
  }
  return employees
}

/** Every (day, shift, role) combo needs exactly 1 slot: 7×3×3 = 63 role-slots. */
function buildRequirements(): EngineInput['requirements'] {
  let reqs = {}
  for (const role of ROLES) {
    reqs = mergeReqs(reqs, reqFor(ALL_DAYS, 'morning', role, 1))
    reqs = mergeReqs(reqs, reqFor(ALL_DAYS, 'noon', role, 1))
    reqs = mergeReqs(reqs, reqFor(ALL_DAYS, 'night', role, 1))
  }
  return reqs
}

/** Mixed requests: preferences, off-days (soft + hard), spread deterministically
 *  across employees/days so the request-honoring + carry-over passes have real
 *  contention to resolve (not a trivially-empty request map). */
function buildMixedRequests(employees: Employee[]) {
  return buildRequests(employees, (id, d) => {
    const n = Number(id.slice(1))
    if ((n + d) % 7 === 0) return { off: true } // soft off, ~1/week each
    if ((n + d) % 11 === 0) return { offHard: true } // occasional hard off
    const preferred: ShiftKey[] = [BASE_SHIFTS[(n + d) % 3]]
    return { preferred }
  })
}

function buildBenchmarkInput(seed: number): EngineInput {
  const employees = buildEmployees()
  const days = plainWeek([{}, {}, {}, {}, {}, { index: 5, isHolidayEve: false, isHoliday: false }, {}])
  return input({
    employees,
    days,
    requirements: buildRequirements(),
    requests: buildMixedRequests(employees),
    seed,
  })
}

describe('engine performance baseline (C1)', () => {
  it('generates a 20-employee/63-slot schedule in well under the regression tripwire, deterministically', () => {
    const RUNS = 5
    const timingsMs: number[] = []
    let firstResult: ReturnType<typeof generateSchedule> | undefined
    let secondResult: ReturnType<typeof generateSchedule> | undefined

    for (let i = 0; i < RUNS; i++) {
      const engineInput = buildBenchmarkInput(42)
      const start = performance.now()
      const result = generateSchedule(engineInput)
      timingsMs.push(performance.now() - start)
      if (i === 0) firstResult = result
      if (i === 1) secondResult = result
    }

    const sorted = [...timingsMs].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    // Single allowed log line for this benchmark (kept to one line for readable test output).
    console.log(
      `[engine-perf] 20 emp x 63 slots: runs=${timingsMs.map((t) => t.toFixed(1)).join(',')}ms median=${median.toFixed(1)}ms`,
    )

    // (1) Generous regression tripwire — NOT a tuning target.
    expect(median).toBeLessThan(2000)

    // (2) Determinism: two runs with the SAME seed produce a fully deeply-equal
    // EngineResult (every field — not a hand-picked subset).
    expect(secondResult).toEqual(firstResult)
  })
})
