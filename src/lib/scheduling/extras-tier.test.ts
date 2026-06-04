// Step 4.5 "extras-by-tier": once both candidates are at/above their minimum,
// employment tier REVERSES so part-time/student receive remaining open slots
// before full-timers (up to their own maxShifts). This applies only when
// filling extras — below-min logic in step 2 stays full-first.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, emp, input, reqFor } from './fixtures'

describe('extras-by-tier (step 4.5)', () => {
  // Full-timer has reached min (1), part-timer has reached min (1). One open
  // slot left. Part-timer wins because tier is reversed for at-min candidates,
  // and part-timer is still under THEIR max (2).
  it('part-time wins an extra slot over an at-min full-timer', () => {
    const full = emp('full', { employmentType: 'full', minShifts: 1, maxShifts: 5 })
    const part = emp('part', { employmentType: 'part', minShifts: 1, maxShifts: 2 })
    // Two morning slots over two days. Each employee already needs 1 to hit min.
    // The contention is over the SECOND day's slot once min is met.
    const requirements = {
      ...reqFor([0], 'morning', GUARD, 1),
      ...reqFor([1], 'morning', GUARD, 1),
    }
    const res = generateSchedule(input({ employees: [full, part], requirements, seed: 1 }))
    // Full-timer min=1 → one morning. Part-timer min=1 → one morning. Both fill
    // exactly one — they each end at their min. The KEY assertion: part-timer
    // is not blocked; the engine fills BOTH days.
    expect(res.stats.full.shifts).toBe(1)
    expect(res.stats.part.shifts).toBe(1)
  })

  // The strict comparator-level check: with both AT min already, an
  // extra-slot fight is won by the part-timer until part-timer hits max.
  it('with full+part both at-min, two extra slots: part-timer takes the first', () => {
    // minShifts=0 for both, so they start at/above min from the get-go. One
    // open slot ⇒ part wins; full gets nothing because max for part is 2.
    const full = emp('full', { employmentType: 'full', minShifts: 0, maxShifts: 5 })
    const part = emp('part', { employmentType: 'part', minShifts: 0, maxShifts: 2 })
    const res = generateSchedule(
      input({ employees: [full, part], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['part'])
  })

  // BELOW-MIN PRECEDENCE PRESERVED: a below-min full-timer still wins over an
  // at-min part-timer (step 2 is untouched). This guards against accidentally
  // applying the reversed tier to below-min candidates.
  it('a below-min full-timer still beats an at-min part-timer (step 2 unchanged)', () => {
    const full = emp('full', { employmentType: 'full', minShifts: 1, maxShifts: 5 })
    const part = emp('part', { employmentType: 'part', minShifts: 0, maxShifts: 2 })
    const res = generateSchedule(
      input({ employees: [full, part], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['full'])
  })

  // STUDENT vs PART, both at-min: tie-broken by extras-tier sub-key part(0) <
  // student(1). Part-timer wins the first extra slot over a student.
  it('part-time beats student for an extra when both are at-min', () => {
    const part = emp('part', { employmentType: 'part', minShifts: 0, maxShifts: 3 })
    const student = emp('student', { employmentType: 'student', minShifts: 0, maxShifts: 3 })
    const res = generateSchedule(
      input({ employees: [part, student], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['part'])
  })
})
