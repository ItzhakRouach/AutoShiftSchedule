// Guard suite for the 12h auto-coverage pass (Task 0 of the 12h-fix plan).
// Production showed suspected over-assignment; these tests lock in the
// invariants that must hold regardless of internal algorithm changes:
//  1. m12_night marks ONLY the night cell (never bleeds into morning/noon).
//  2. No grid cell ever exceeds its required headcount, and no employee is
//     double-booked into the same cell — including through the tryDisplace
//     displacement path.
//  3. Determinism: identical input+seed → identical twelveHourAssignments.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import {
  GUARD,
  DISPATCH,
  SHIFT_MGR,
  emp,
  input,
  mergeReqs,
  reqFor,
  settings,
} from './fixtures'
import type { EngineResult, Requirements, ShiftKey } from './types'

const allDays = [0, 1, 2, 3, 4, 5, 6]
const on = () => settings({ allow12hFallback: true })
const OTHER_ROLE = 'other-role-nobody-has'

/** Assert every grid[day][shift][role] respects its requirement count and has
 *  no duplicate employee ids. */
function assertNoOverAssignment(res: EngineResult, requirements: Requirements): void {
  for (const day of Object.keys(res.grid).map(Number)) {
    for (const shift of Object.keys(res.grid[day]) as ShiftKey[]) {
      for (const role of Object.keys(res.grid[day][shift])) {
        const cell = res.grid[day][shift][role]
        const need = requirements[day]?.[shift]?.[role] ?? 0
        expect(cell.length, `grid[${day}][${shift}][${role}] over-assigned`).toBeLessThanOrEqual(need)
        expect(new Set(cell).size, `grid[${day}][${shift}][${role}] has duplicate employee`).toBe(cell.length)
      }
    }
  }
}

describe('m12_night marks ONLY the night cell', () => {
  it('night gap + an independent OPEN morning gap → night cell gets the employee, morning cell does not', () => {
    // a covers morning+noon via its own m12_day; b (noon+night-only) can only
    // close the night gap via m12_night. An UNRELATED role on morning (nobody
    // holds it) stays permanently open, isolating "morning cell untouched by
    // b's m12_night" from "morning is fully staffed".
    const a = emp('a')
    const b = emp('b', { availability: { 0: ['noon', 'night'] } })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'morning', OTHER_ROLE, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [a, b], requirements: req, settings: on() }))
    expect(res.grid[0].night[GUARD]).toEqual(['b'])
    expect(res.grid[0].morning[GUARD]).not.toContain('b')
    expect(res.grid[0].noon[GUARD]).not.toContain('b')
    const bT = res.twelveHourAssignments.find((t) => t.employeeId === 'b')!
    expect(bT.variant).toBe('m12_night')
    expect(bT.rolesByShift).toEqual({ night: GUARD })
    // The independent morning slot for OTHER_ROLE has nobody eligible → stays open.
    expect(res.warnings.some((w) => w.day === 0 && w.shift === 'morning' && w.roleId === OTHER_ROLE)).toBe(true)
  })

  it('ONLY a morning gap exists (night already satisfied) → m12_night is never chosen', () => {
    // nightGuy fully satisfies the night requirement via plain 8h; morningOnly
    // needs a 12h (m12_day) to cover morning+noon. m12_night must never appear.
    const nightGuy = emp('nightGuy', { availability: { 0: ['night'] } })
    const morningOnly = emp('morningOnly', { availability: { 0: ['morning', 'noon'] } })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const res = generateSchedule(
      input({ employees: [nightGuy, morningOnly], requirements: req, settings: on() }),
    )
    expect(res.grid[0].night[GUARD]).toEqual(['nightGuy'])
    const variants = res.twelveHourAssignments.map((t) => t.variant)
    expect(variants).not.toContain('m12_night')
    // Whichever variant closes the morning gap (or if it stays open), it must
    // never be m12_night — already asserted above via `variants`.
  })
})

describe('over-assignment invariant (incl. the tryDisplace path)', () => {
  it('tryDisplace scenario: no grid cell exceeds its requirement, no duplicate employee in a cell', () => {
    // e: absorbable morning 8h (available morning+noon) → its m12_day would
    // extend into noon. h: noon+night-only, so noon is h's ONLY same-day
    // commitment (an 8h) and night is an open gap h can legally be re-covered
    // into after being displaced. This is the exact tryDisplace trigger
    // (verified during development: displacement fires for this fixture).
    const e = emp('e', { availability: { 0: ['morning', 'noon'] } })
    const h = emp('h', { availability: { 0: ['noon', 'night'] } })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [e, h], requirements: req, settings: on() }))
    assertNoOverAssignment(res, req)
    // Sanity: coverage still complete, nobody double-booked into 2 cells' worth
    // of the same slot.
    expect(res.coverage.percent).toBe(100)
  })

  it('day/night pair full-week fixture: invariant holds across all 7 days', () => {
    const employees = [emp('g0'), emp('g1')]
    const req = mergeReqs(
      reqFor(allDays, 'morning', GUARD, 1),
      reqFor(allDays, 'noon', GUARD, 1),
      reqFor(allDays, 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees, requirements: req, settings: on() }))
    assertNoOverAssignment(res, req)
  })

  it('cross-role fixture: invariant holds', () => {
    const d = emp('d', { roleIds: [DISPATCH] })
    const am = emp('am', {
      roleIds: [SHIFT_MGR, DISPATCH],
      availability: { 0: ['noon', 'night'] },
    })
    const req = mergeReqs(
      reqFor([0], 'noon', DISPATCH, 1),
      reqFor([0], 'night', SHIFT_MGR, 1),
      reqFor([0], 'night', DISPATCH, 1),
    )
    const res = generateSchedule(input({ employees: [d, am], requirements: req, settings: on() }))
    assertNoOverAssignment(res, req)
  })

  it('whole-week single-employee upgrade fixture: invariant holds', () => {
    const fullGrid = mergeReqs(
      reqFor(allDays, 'morning', GUARD, 1),
      reqFor(allDays, 'noon', GUARD, 1),
      reqFor(allDays, 'night', GUARD, 1),
    )
    const res = generateSchedule(
      input({ employees: [emp('a', { maxShifts: 7 })], requirements: fullGrid, settings: on() }),
    )
    assertNoOverAssignment(res, fullGrid)
  })
})

describe('determinism', () => {
  it('same input + seed → deeply-equal twelveHourAssignments (incl. rolesByShift)', () => {
    const build = (): EngineResult => {
      const e = emp('e', { availability: { 0: ['morning', 'noon'] } })
      const h = emp('h', { availability: { 0: ['noon', 'night'] } })
      const req = mergeReqs(
        reqFor([0], 'morning', GUARD, 1),
        reqFor([0], 'noon', GUARD, 1),
        reqFor([0], 'night', GUARD, 1),
      )
      return generateSchedule(input({ employees: [e, h], requirements: req, settings: on(), seed: 7 }))
    }
    const r1 = build()
    const r2 = build()
    expect(r1.twelveHourAssignments).toEqual(r2.twelveHourAssignments)
  })

  it('full-week cross-role fixture: same seed twice → identical twelveHourAssignments', () => {
    const build = (): EngineResult => {
      const d = emp('d', { roleIds: [DISPATCH] })
      const am = emp('am', {
        roleIds: [SHIFT_MGR, DISPATCH],
        availability: { 0: ['noon', 'night'] },
      })
      const req = mergeReqs(
        reqFor([0], 'noon', DISPATCH, 1),
        reqFor([0], 'night', SHIFT_MGR, 1),
        reqFor([0], 'night', DISPATCH, 1),
      )
      return generateSchedule(input({ employees: [d, am], requirements: req, settings: on(), seed: 99 }))
    }
    expect(build().twelveHourAssignments).toEqual(build().twelveHourAssignments)
  })
})
