import { describe, it, expect } from 'vitest'
import { buildEmpDistribution, twelveBucketOf, DIST_BUCKETS } from './emp-distribution'
import { buildEmpTotals } from './week-table-data'
import { buildEmpHours } from './week-table-metrics'
import type { ScheduleView } from './view-data'

// Local fixture, matching the convention in week-table-data.test.ts — every
// schedule test file keeps its own makeView rather than sharing one.
function makeView(overrides: Partial<ScheduleView> = {}): ScheduleView {
  return {
    periodId: 'p1',
    status: 'draft',
    weekStart: '2026-06-01',
    days: Array.from({ length: 7 }, (_, i) => ({ index: i, short: `${i}`, date: '' })),
    shiftKeys: ['morning', 'noon', 'night'],
    roles: [
      { id: 'r-achm', name: 'אחמ״ש' },
      { id: 'r-guard', name: 'מאבטח' },
    ],
    employees: [
      { id: 'e1', name: 'Alice', color: '#f00' },
      { id: 'e2', name: 'Bob', color: '#00f' },
      { id: 'e3', name: 'Carol', color: '#0f0' }, // stays at zero shifts
    ],
    requirements: {},
    grid: {},
    twelve: [],
    temps: [],
    shiftTypeIdByKey: { morning: 'st1', noon: 'st2', night: 'st3' },
    hasAssignments: true,
    feasibility: null,
    requests: [],
    requestedSet: new Set<string>(),
    ...overrides,
  }
}

const rowOf = (view: ScheduleView, id: string) =>
  buildEmpDistribution(view).rows.find((r) => r.employeeId === id)!

describe('twelveBucketOf', () => {
  it('maps the two scheduled variants to their own buckets', () => {
    expect(twelveBucketOf('m12_day')).toBe('m12_day')
    expect(twelveBucketOf('m12_night')).toBe('m12_night')
  })

  it('folds the never-scheduled legacy variants by their dominant half', () => {
    expect(twelveBucketOf('m12_3to15')).toBe('m12_day') // 03-15 is daytime
    expect(twelveBucketOf('m12_15to3')).toBe('m12_night') // 15-03 is nightside
  })

  it('falls back rather than dropping an unknown variant', () => {
    expect(DIST_BUCKETS).toContain(twelveBucketOf('something_else'))
  })
})

describe('buildEmpDistribution — base buckets', () => {
  it('counts each base shift into its matching bucket', () => {
    const view = makeView({
      grid: {
        0: { morning: { 'r-achm': ['e1'] } },
        1: { noon: { 'r-guard': ['e1'] } },
        2: { night: { 'r-guard': ['e1'] } },
      },
    })
    const r = rowOf(view, 'e1')
    expect(r.counts.morning).toBe(1)
    expect(r.counts.noon).toBe(1)
    expect(r.counts.night).toBe(1)
    expect(r.counts.m12_day).toBe(0)
    expect(r.counts.m12_night).toBe(0)
    expect(r.total).toBe(3)
  })

  it('records which bucket was worked on which day', () => {
    const view = makeView({ grid: { 3: { night: { 'r-guard': ['e1'] } } } })
    const r = rowOf(view, 'e1')
    expect(r.byDay[3]).toEqual(['night'])
    expect(r.byDay[0]).toEqual([])
  })
})

describe('buildEmpDistribution — 12h is never double-counted', () => {
  it('counts m12_day ONCE in m12_day and zero in morning/noon', () => {
    // This is the trap: twelveFillsOf would expand m12_day to [morning, noon].
    const view = makeView({
      grid: {},
      twelve: [{ day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' }],
    })
    const r = rowOf(view, 'e1')
    expect(r.counts.m12_day).toBe(1)
    expect(r.counts.morning).toBe(0)
    expect(r.counts.noon).toBe(0)
    expect(r.total).toBe(1)
  })

  it('counts m12_night ONCE in m12_night and zero in noon/night', () => {
    const view = makeView({
      grid: {},
      twelve: [{ day: 0, variant: 'm12_night', roleId: 'r-guard', employeeId: 'e1' }],
    })
    const r = rowOf(view, 'e1')
    expect(r.counts.m12_night).toBe(1)
    expect(r.counts.noon).toBe(0)
    expect(r.counts.night).toBe(0)
  })

  it('dedups one 12h that appears as two twelve rows under different roles', () => {
    const view = makeView({
      grid: {},
      twelve: [
        { day: 0, variant: 'm12_day', roleId: 'r-achm', employeeId: 'e1' },
        { day: 0, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' },
      ],
    })
    expect(rowOf(view, 'e1').counts.m12_day).toBe(1)
    expect(rowOf(view, 'e1').total).toBe(1)
  })
})

describe('buildEmpDistribution — agreement with the trusted helpers', () => {
  // The highest-value tests: these guarantee the drawer can never show numbers
  // that disagree with the chip bar under the table.
  const views: [string, ScheduleView][] = [
    ['empty week', makeView()],
    ['base only', makeView({ grid: { 0: { morning: { 'r-achm': ['e1'] }, noon: { 'r-guard': ['e2'] } } } })],
    ['12h only', makeView({ twelve: [{ day: 1, variant: 'm12_night', roleId: 'r-guard', employeeId: 'e1' }] })],
    ['mixed', makeView({
      grid: { 0: { morning: { 'r-achm': ['e1'] } }, 2: { night: { 'r-guard': ['e2'] } } },
      twelve: [{ day: 4, variant: 'm12_day', roleId: 'r-guard', employeeId: 'e1' }],
    })],
    ['legacy variants', makeView({
      twelve: [
        { day: 0, variant: 'm12_3to15', roleId: 'r-guard', employeeId: 'e1' },
        { day: 1, variant: 'm12_15to3', roleId: 'r-guard', employeeId: 'e2' },
      ],
    })],
  ]

  for (const [label, view] of views) {
    it(`agrees with buildEmpTotals and buildEmpHours — ${label}`, () => {
      const totals = buildEmpTotals(view, view.employees)
      const hours = buildEmpHours(view)
      for (const r of buildEmpDistribution(view).rows) {
        const summed = DIST_BUCKETS.reduce((n, b) => n + r.counts[b], 0)
        expect(summed).toBe(r.total)
        expect(r.total).toBe(totals[r.employeeId])
        expect(r.hours).toBe(hours[r.employeeId])
        expect(r.byDay.flat().length).toBe(r.total)
      }
    })
  }
})

describe('buildEmpDistribution — rows and aggregates', () => {
  it('includes a worker with no shifts at all', () => {
    const view = makeView({ grid: { 0: { morning: { 'r-achm': ['e1'] } } } })
    const r = rowOf(view, 'e3')
    expect(r.total).toBe(0)
    expect(r.hours).toBe(0)
    expect(DIST_BUCKETS.every((b) => r.counts[b] === 0)).toBe(true)
  })

  it('keeps view.employees order and carries name and colour', () => {
    const d = buildEmpDistribution(makeView())
    expect(d.rows.map((r) => r.employeeId)).toEqual(['e1', 'e2', 'e3'])
    expect(d.rows[0].name).toBe('Alice')
    expect(d.rows[0].color).toBe('#f00')
  })

  it('floors the bar denominators at 1 so an empty week cannot divide by zero', () => {
    const d = buildEmpDistribution(makeView())
    expect(d.maxTotal).toBe(1)
    expect(d.maxBucket).toBe(1)
    expect(d.avgTotal).toBe(0)
  })

  it('averages over ALL workers including the zero-shift ones', () => {
    const view = makeView({
      grid: { 0: { morning: { 'r-achm': ['e1'] } }, 1: { morning: { 'r-achm': ['e1'] } } },
    })
    // e1=2, e2=0, e3=0 → 2/3
    expect(buildEmpDistribution(view).avgTotal).toBeCloseTo(2 / 3, 6)
  })

  it('reports per-bucket column totals and the largest single bucket', () => {
    const view = makeView({
      grid: {
        0: { night: { 'r-guard': ['e1'] } },
        1: { night: { 'r-guard': ['e1'] } },
        2: { night: { 'r-guard': ['e2'] } },
      },
    })
    const d = buildEmpDistribution(view)
    expect(d.bucketTotals.night).toBe(3)
    expect(d.bucketTotals.morning).toBe(0)
    expect(d.maxTotal).toBe(2) // e1
    expect(d.maxBucket).toBe(2) // e1's nights
  })

  it('ignores temp workers, who carry no employee identity', () => {
    const base = makeView({ grid: { 0: { morning: { 'r-achm': ['e1'] } } } })
    const withTemp = makeView({
      grid: { 0: { morning: { 'r-achm': ['e1'] } } },
      temps: [{ day: 1, shiftKey: 'noon', roleId: 'r-guard', assignmentId: 'a1', name: 'דני' }],
    })
    expect(buildEmpDistribution(withTemp).rows).toEqual(buildEmpDistribution(base).rows)
  })

  it('ignores a grid entry for an unknown employee id', () => {
    const view = makeView({ grid: { 0: { morning: { 'r-achm': ['ghost'] } } } })
    const d = buildEmpDistribution(view)
    expect(d.rows).toHaveLength(3)
    expect(d.rows.every((r) => r.total === 0)).toBe(true)
  })
})
