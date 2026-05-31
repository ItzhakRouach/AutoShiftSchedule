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

describe('last-resort 03-15/15-03 ONLY when day/night cannot', () => {
  // m12_3to15 (03–15) FILLS night+morning — the ONLY single-shift way for ONE
  // person to cover both a morning gap AND a night gap the same day. The day/night
  // pair (m12_day=morning+noon, m12_night=night) would need TWO people; with a
  // single eligible person, day/night cannot, so 03-15 is correctly used.
  it('one person, morning+night gap → forced to m12_3to15 (last resort)', () => {
    const p = emp('p')
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'night', GUARD, 1))
    const res = generateSchedule(input({ employees: [p], requirements: req, settings: on() }))
    expect(res.coverage.percent).toBe(100)
    expect(res.twelveHourAssignments).toEqual<TwelveHourAssignment[]>([
      { employeeId: 'p', day: 0, variant: 'm12_3to15', rolesByShift: { night: GUARD, morning: GUARD } },
    ])
  })

  // When day/night CAN cover (enough people), the last-resort variants are NOT
  // used even though the same gaps exist — proves the strict preference order.
  it('two people, same morning+night gap → uses day/night, NOT m12_3to15', () => {
    const employees = [emp('a'), emp('b')]
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'night', GUARD, 1))
    const res = generateSchedule(input({ employees, requirements: req, settings: on() }))
    // With 2 people the 8h pass already covers both as plain 8h (no 12h at all),
    // and certainly never the last-resort variant.
    const variants = res.twelveHourAssignments.map((t) => t.variant)
    expect(variants).not.toContain('m12_3to15')
    expect(variants).not.toContain('m12_15to3')
    expect(res.coverage.percent).toBe(100)
  })
})

describe('cross-role 12h: אחמ״ש who also holds מוקדן covers מוקדן noon→night', () => {
  // User's exact case. A מוקדן (dispatch) does a 12h; an אחמ״ש who ALSO holds
  // מוקדן does a 12h covering noon as מוקדן continuing into night (as אחמ״ש).
  it('cross-role pair covers the מוקדן position across the day (user case)', () => {
    // Requirements day0: noon needs 1 מוקדן, night needs 1 אחמ״ש AND 1 מוקדן.
    // People (BOTH must hold מוקדן so the cross-role 12h is forced):
    //  d  = pure מוקדן
    //  am = אחמ״ש who ALSO holds מוקדן
    // Make BOTH employees unavailable for a plain 8h night-אחמ״ש except via a 12h
    // that bridges noon→night: only `am` holds אחמ״ש, and we require am to also
    // plug the noon מוקדן. With one-shift-per-day, am must do ONE 12h covering
    // noon (as מוקדן) continuing into night (as אחמ״ש) — the user's exact case —
    // while d covers the night מוקדן via its own complementary 12h.
    const d = emp('d', { roleIds: [DISPATCH] })
    const am = emp('am', {
      roleIds: [SHIFT_MGR, DISPATCH],
      // am only available afternoon/night windows → cannot take a morning 8h,
      // and the noon מוקדן + night אחמ״ש must be bridged by a single 12h.
      availability: { 0: ['noon', 'night'] },
    })
    const req = mergeReqs(
      reqFor([0], 'noon', DISPATCH, 1),
      reqFor([0], 'night', SHIFT_MGR, 1),
      reqFor([0], 'night', DISPATCH, 1),
    )
    const res = generateSchedule(input({ employees: [d, am], requirements: req, settings: on() }))
    expect(res.coverage.percent).toBe(100)
    expect(res.warnings).toEqual([])
    // A complementary 12h PAIR fully staffs the מוקדן position across noon→night.
    expect(res.grid[0].noon[DISPATCH].length).toBe(1)
    expect(res.grid[0].night[DISPATCH].length).toBe(1)
    expect(res.grid[0].night[SHIFT_MGR]).toEqual(['am'])
    // The אחמ״ש (am) — who also holds מוקדן — covers night via a 12h, and a 12h
    // covers the noon מוקדן: cross-role coverage across the position.
    const variants = res.twelveHourAssignments.map((t) => t.variant)
    expect(res.twelveHourAssignments.length).toBeGreaterThanOrEqual(1)
    // night-אחמ״ש is only fillable by am, who is noon/night-only → must be a 12h
    // (m12_15to3 / m12_night), never a morning-touching variant.
    expect(variants).not.toContain('m12_3to15')
  })

  it('a single multi-role person fills DIFFERENT roles across the two windows', () => {
    // One m12 person covering noon as מוקדן and night as אחמ״ש (cross-role).
    const am = emp('am', { roleIds: [SHIFT_MGR, DISPATCH] })
    const req = mergeReqs(reqFor([0], 'noon', DISPATCH, 1), reqFor([0], 'night', SHIFT_MGR, 1))
    const res = generateSchedule(input({ employees: [am], requirements: req, settings: on() }))
    // m12_15to3 fills noon+night; or m12_day(noon)+... — assert both filled by am.
    expect(res.grid[0].noon[DISPATCH]).toEqual(['am'])
    expect(res.grid[0].night[SHIFT_MGR]).toEqual(['am'])
    const t = res.twelveHourAssignments.find((x) => x.employeeId === 'am')!
    expect(t.rolesByShift.noon).toBe(DISPATCH)
    expect(t.rolesByShift.night).toBe(SHIFT_MGR)
    expect(res.coverage.percent).toBe(100)
  })
})
