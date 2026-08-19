// Hard-days-first fill order: Friday/Saturday/holiday slots are assigned before
// the rest of the week, so scarce capacity is spent on the hardest days first.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { runFill, runFillHardDaysAware } from './fill'
import { GUARD, buildRequests, emp, input, mergeReqs, plainWeek, reqFor } from './fixtures'

describe('hard-days-first: scarce capacity goes to Fri/Sat/holiday before weekdays', () => {
  it('one worker, one shift budget, Sunday+Friday required → Friday wins', () => {
    const employees = [emp('flex', { maxShifts: 1 })]
    const res = generateSchedule(
      input({
        employees,
        requirements: mergeReqs(reqFor([0], 'noon', GUARD, 1), reqFor([5], 'noon', GUARD, 1)),
      }),
    )
    expect(res.grid[5].noon[GUARD]).toEqual(['flex'])
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0]).toMatchObject({ day: 0, shift: 'noon' })
  })

  it('one worker, one shift budget, Sunday+Saturday required → Saturday wins', () => {
    const employees = [emp('flex', { maxShifts: 1 })]
    const res = generateSchedule(
      input({
        employees,
        requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([6], 'morning', GUARD, 1)),
      }),
    )
    expect(res.grid[6].morning[GUARD]).toEqual(['flex'])
    expect(res.warnings[0]).toMatchObject({ day: 0, shift: 'morning' })
  })

  it('mid-week holiday outranks a regular weekday', () => {
    const employees = [emp('flex', { maxShifts: 1 })]
    const res = generateSchedule(
      input({
        employees,
        days: plainWeek([{}, {}, { isHoliday: true }]),
        requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([2], 'morning', GUARD, 1)),
      }),
    )
    expect(res.grid[2].morning[GUARD]).toEqual(['flex'])
    expect(res.warnings[0]).toMatchObject({ day: 0, shift: 'morning' })
  })

  it('requested shifts: a capped worker keeps the Friday request over the Sunday one', () => {
    const employees = [emp('flex', { maxShifts: 1 })]
    const res = generateSchedule(
      input({
        employees,
        requests: buildRequests(employees, (_id, day) =>
          day === 0 || day === 5 ? { preferred: ['noon'] } : {},
        ),
        requirements: mergeReqs(reqFor([0], 'noon', GUARD, 1), reqFor([5], 'noon', GUARD, 1)),
      }),
    )
    expect(res.grid[5].noon[GUARD]).toEqual(['flex'])
  })

  it('fully-staffable week: no retry — result is exactly the chronological fill', () => {
    const employees = Array.from({ length: 3 }, (_, i) => emp(`g${i}`))
    const reqs = mergeReqs(
      reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 1),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'noon', GUARD, 1),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 1),
    )
    const inp = input({ employees, requirements: reqs })
    expect(JSON.stringify(runFillHardDaysAware(inp).committed)).toBe(
      JSON.stringify(runFill(inp).committed),
    )
  })

  it('tie (hard-day gap unfixable either way) keeps the fairer chronological run', () => {
    // 21 staffable guard slots + one Friday slot for a role NOBODY holds: both
    // orders leave exactly that 1 hard-day gap and fill 21, so the comparator
    // ties — and must keep the chronological run (better fairness), not the
    // hard-first one.
    const employees = Array.from({ length: 5 }, (_, i) => emp(`g${i}`))
    const reqs = mergeReqs(
      reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 1),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'noon', GUARD, 1),
      reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 1),
      reqFor([5], 'noon', 'תפקיד-שאין-לאיש', 1),
    )
    const inp = input({ employees, requirements: reqs })
    const chosen = JSON.stringify(runFillHardDaysAware(inp).committed)
    const chrono = JSON.stringify(runFill(inp).committed)
    const hardFirst = JSON.stringify(runFill(inp, false, false, false, true).committed)
    expect(hardFirst).not.toBe(chrono) // the tie is real, not vacuous
    expect(chosen).toBe(chrono)
  })

  it('full coverage when the only Shabbat-legal worker is saved for Friday (any seed)', () => {
    // obs is blocked on Fri noon (Shabbat); flex can work anywhere but only once.
    // Filling Friday first guarantees flex→Friday, obs→Sunday: 100% coverage
    // regardless of scoring/lottery order.
    for (let seed = 1; seed <= 10; seed++) {
      const employees = [emp('obs', { observesShabbat: true }), emp('flex', { maxShifts: 1 })]
      const res = generateSchedule(
        input({
          employees,
          seed,
          requirements: mergeReqs(reqFor([0], 'noon', GUARD, 1), reqFor([5], 'noon', GUARD, 1)),
        }),
      )
      expect(res.coverage.percent).toBe(100)
      expect(res.grid[5].noon[GUARD]).toEqual(['flex'])
      expect(res.grid[0].noon[GUARD]).toEqual(['obs'])
    }
  })
})
