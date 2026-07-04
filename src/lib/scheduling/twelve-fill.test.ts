// Exhaustive 12h auto-coverage suite. Hand-computed fixtures, EXACT assertions.
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
import type { Assignment, TwelveHourAssignment } from './types'

const allDays = [0, 1, 2, 3, 4, 5, 6]
const on = () => settings({ allow12hFallback: true })

/** All committed assignments flattened. */
function flat(byEmp: Record<string, Assignment[]>): Assignment[] {
  return Object.values(byEmp).flat()
}

describe('12h disabled → no auto 12h, gaps remain as warnings', () => {
  it('one guard, two same-day shifts: 1 fills, the other warns (no 12h)', () => {
    const res = generateSchedule(
      input({
        employees: [emp('solo')],
        requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'night', GUARD, 1)),
        settings: settings({ allow12hFallback: false }),
      }),
    )
    expect(res.twelveHourAssignments).toEqual([])
    expect(res.warnings.length).toBe(1)
  })
})

describe('day/night 12h PAIR is preferred over 03-15/15-03', () => {
  // Two guards only, full day morning+noon+night each needing 1 guard, every day.
  // 8h cannot fully staff (2 people, 3 slots/day, rest). 12h day/night pair can:
  // g0 = m12_day (morning+noon), g1 = m12_night (night). Full coverage, no
  // 03-15/15-03 used.
  it('covers full week with m12_day + m12_night, never the last-resort variants', () => {
    const employees = [emp('g0'), emp('g1')]
    const req = mergeReqs(
      reqFor(allDays, 'morning', GUARD, 1),
      reqFor(allDays, 'noon', GUARD, 1),
      reqFor(allDays, 'night', GUARD, 1),
    )
    const res = generateSchedule(input({ employees, requirements: req, settings: on() }))
    expect(res.warnings).toEqual([])
    expect(res.coverage.percent).toBe(100)
    const variants = res.twelveHourAssignments.map((t) => t.variant)
    expect(variants).not.toContain('m12_3to15')
    expect(variants).not.toContain('m12_15to3')
    expect(new Set(variants)).toEqual(new Set(['m12_day', 'm12_night']))
    // Each day: one m12_day + one m12_night, complementary pair.
    for (const d of allDays) {
      const dayT = res.twelveHourAssignments.filter((t) => t.day === d)
      expect(dayT.map((t) => t.variant).sort()).toEqual(['m12_day', 'm12_night'])
    }
    // grid cells flagged is12h.
    for (const a of flat(res.assignmentsByEmployee)) expect(a.is12h).toBe(true)
  })
})

describe('m12_day fills morning AND noon (counts toward each)', () => {
  it('single guard, morning+noon gap → one m12_day covers both', () => {
    const res = generateSchedule(
      input({
        employees: [emp('g')],
        requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'noon', GUARD, 1)),
        settings: on(),
      }),
    )
    expect(res.warnings).toEqual([])
    expect(res.twelveHourAssignments).toEqual<TwelveHourAssignment[]>([
      { employeeId: 'g', day: 0, variant: 'm12_day', rolesByShift: { morning: GUARD, noon: GUARD } },
    ])
    expect(res.grid[0].morning[GUARD]).toEqual(['g'])
    expect(res.grid[0].noon[GUARD]).toEqual(['g'])
  })
})

describe('off-cycle 03-15/15-03 are never auto-assigned (removed)', () => {
  // 03–15 (m12_3to15) fills night+morning and 15–03 (m12_15to3) fills noon+night —
  // the only single-shift ways for ONE person to bridge two non-adjacent gaps. Both
  // were intentionally removed (only the day/night pair remains), so a lone person
  // can no longer cover both gaps: one slot is left as an uncovered warning.
  it('one person, morning+night gap → one slot warns, no off-cycle 12h', () => {
    const p = emp('p')
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'night', GUARD, 1))
    const res = generateSchedule(input({ employees: [p], requirements: req, settings: on() }))
    expect(res.warnings.length).toBe(1)
    expect(res.coverage.percent).toBeLessThan(100)
    const variants = res.twelveHourAssignments.map((t) => t.variant)
    expect(variants).not.toContain('m12_3to15')
    expect(variants).not.toContain('m12_15to3')
  })

  // When day/night CAN cover (enough people), no 12h is needed and certainly never
  // an off-cycle variant.
  it('two people, same morning+night gap → uses day/night, NOT off-cycle', () => {
    const employees = [emp('a'), emp('b')]
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'night', GUARD, 1))
    const res = generateSchedule(input({ employees, requirements: req, settings: on() }))
    const variants = res.twelveHourAssignments.map((t) => t.variant)
    expect(variants).not.toContain('m12_3to15')
    expect(variants).not.toContain('m12_15to3')
    expect(res.coverage.percent).toBe(100)
  })
})

describe('cross-role 12h with the day/night pair only', () => {
  it('a multi-role person covers morning+noon as DIFFERENT roles via one m12_day', () => {
    // am holds both roles; m12_day (07–19) fills morning+noon. Require morning as
    // מוקדן and noon as אחמ״ש → a single m12_day person fills BOTH windows cross-role.
    const am = emp('am', { roleIds: [SHIFT_MGR, DISPATCH] })
    const req = mergeReqs(reqFor([0], 'morning', DISPATCH, 1), reqFor([0], 'noon', SHIFT_MGR, 1))
    const res = generateSchedule(input({ employees: [am], requirements: req, settings: on() }))
    expect(res.coverage.percent).toBe(100)
    expect(res.grid[0].morning[DISPATCH]).toEqual(['am'])
    expect(res.grid[0].noon[SHIFT_MGR]).toEqual(['am'])
    const t = res.twelveHourAssignments.find((x) => x.employeeId === 'am')!
    expect(t.variant).toBe('m12_day')
    expect(t.rolesByShift.morning).toBe(DISPATCH)
    expect(t.rolesByShift.noon).toBe(SHIFT_MGR)
  })

  it('single person can no longer bridge noon→night cross-role (off-cycle removed)', () => {
    // Previously m12_15to3 let one person cover noon (מוקדן) + night (אחמ״ש) in one
    // shift. With it removed, a lone person covers only ONE window; the other warns.
    const am = emp('am', { roleIds: [SHIFT_MGR, DISPATCH] })
    const req = mergeReqs(reqFor([0], 'noon', DISPATCH, 1), reqFor([0], 'night', SHIFT_MGR, 1))
    const res = generateSchedule(input({ employees: [am], requirements: req, settings: on() }))
    expect(res.warnings.length).toBe(1)
    expect(res.coverage.percent).toBeLessThan(100)
    const variants = res.twelveHourAssignments.map((t) => t.variant)
    expect(variants).not.toContain('m12_15to3')
    expect(variants).not.toContain('m12_3to15')
  })
})
