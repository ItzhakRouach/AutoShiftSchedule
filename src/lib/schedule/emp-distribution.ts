/**
 * Per-employee shift distribution for the week — the data behind the manager's
 * "is this week fair?" drawer. Pure, no IO, client-safe.
 *
 * Five buckets: the three base shifts plus the two 12h variants that are
 * actually scheduled. Every bucket key is a real ShiftId, so the label, colour
 * and time come from SHIFT_META (or the workplace's own row via
 * `view.shiftMeta`) with no second label table to keep in sync.
 *
 * WHY THIS CANNOT DOUBLE-COUNT A 12h SHIFT — the one thing to understand here.
 * The two sources are disjoint by construction: `splitAssignments`
 * (view-data-grid.ts:69) sends every non-base shift key to `view.twelve` and
 * `continue`s, so a 12h row NEVER enters `view.grid`. Base buckets therefore
 * walk only `view.grid`, and 12h buckets walk only `view.twelve`.
 *
 * Do NOT reach for `twelveFillsOf` / `twelveCoversOf` / `coveredByTwelve` here.
 * Those deliberately expand one 12h into the base windows it covers
 * (m12_day -> [morning, noon]) because the TABLE needs to paint those cells.
 * Using them would count a single 12h shift in `morning` AND `noon` AND
 * `m12_day` — triple. A 12h contributes to its own bucket and nothing else.
 *
 * The traversal and the dedup key deliberately mirror `buildEmpTotals` and
 * `buildEmpHours`, and the test suite asserts agreement with both — so the
 * drawer can never show numbers that contradict the chip bar under the table.
 */
import type { ScheduleView } from './view-data'

/** The five columns the drawer shows, in display order. All real ShiftIds. */
export const DIST_BUCKETS = ['morning', 'noon', 'night', 'm12_day', 'm12_night'] as const
export type DistBucket = (typeof DIST_BUCKETS)[number]
export type BucketCounts = Record<DistBucket, number>

export interface EmpDistributionRow {
  employeeId: string
  name: string
  color: string
  counts: BucketCounts
  /** Σ counts. Always equals buildEmpTotals(view, view.employees)[employeeId]. */
  total: number
  /** 8h per base shift, 12h per 12h shift. Equals buildEmpHours(view)[id]. */
  hours: number
  /** day 0..6 → the buckets worked that day, so the per-worker detail needs no
   *  second traversal. Invariant: byDay.flat().length === total. */
  byDay: DistBucket[][]
}

export interface EmpDistribution {
  /** One row per `view.employees`, in that order. Zero-shift workers are
   *  INCLUDED — a worker with nothing is the loudest fairness signal there is. */
  rows: EmpDistributionRow[]
  /** Denominator for a full-width row bar. Floored at 1: never divide by zero. */
  maxTotal: number
  /** Denominator when a bucket column is scaled on its own. Floored at 1. */
  maxBucket: number
  /** Mean total across ALL rows, zeros included — the fairness reference line. */
  avgTotal: number
  /** Column sums across the whole roster. */
  bucketTotals: BucketCounts
}

const zeroCounts = (): BucketCounts =>
  ({ morning: 0, noon: 0, night: 0, m12_day: 0, m12_night: 0 })

/**
 * Which displayed bucket a persisted 12h variant belongs to. `m12_day` and
 * `m12_night` are the only variants the engine ever schedules
 * (FALLBACK_12H_ORDER), but the two off-cycle ones remain valid historical
 * types, so they fold by their dominant half rather than being dropped — which
 * keeps `sum(counts) === total === buildEmpTotals` true for legacy weeks.
 */
export function twelveBucketOf(variant: string): DistBucket {
  if (variant === 'm12_night') return 'm12_night'
  if (variant === 'm12_15to3') return 'm12_night' // 15:00-03:00 — nightside
  if (variant === 'm12_3to15') return 'm12_day' // 03:00-15:00 — daytime
  return 'm12_day' // m12_day, and any unknown variant, rather than losing it
}

export function buildEmpDistribution(view: ScheduleView): EmpDistribution {
  const counts = new Map<string, BucketCounts>()
  const byDay = new Map<string, DistBucket[][]>()
  for (const e of view.employees) {
    counts.set(e.id, zeroCounts())
    byDay.set(e.id, Array.from({ length: 7 }, () => []))
  }

  const record = (empId: string, day: number, bucket: DistBucket) => {
    const c = counts.get(empId)
    if (!c) return // not on the roster (e.g. a stale grid entry) — ignore
    c[bucket] += 1
    byDay.get(empId)![day]?.push(bucket)
  }

  // Base shifts, straight from the grid. `view.shiftKeys` is the base triple.
  for (let day = 0; day < 7; day++) {
    for (const shift of view.shiftKeys) {
      if (!(shift in zeroCounts())) continue // degrade on an unexpected key
      for (const empIds of Object.values(view.grid[day]?.[shift] ?? {})) {
        for (const id of empIds) record(id, day, shift as DistBucket)
      }
    }
  }

  // 12h shifts, deduped exactly as buildEmpTotals does: one logical shift can
  // appear as several `twelve` rows under different roleIds.
  const seen = new Set<string>()
  for (const t of view.twelve) {
    const key = `${t.day}:${t.variant}:${t.employeeId}`
    if (seen.has(key)) continue
    seen.add(key)
    record(t.employeeId, t.day, twelveBucketOf(t.variant))
  }

  const bucketTotals = zeroCounts()
  let maxTotal = 0
  let maxBucket = 0
  let sumTotal = 0

  const rows: EmpDistributionRow[] = view.employees.map((e) => {
    const c = counts.get(e.id)!
    let total = 0
    for (const b of DIST_BUCKETS) {
      total += c[b]
      bucketTotals[b] += c[b]
      if (c[b] > maxBucket) maxBucket = c[b]
    }
    const hours = 8 * (c.morning + c.noon + c.night) + 12 * (c.m12_day + c.m12_night)
    if (total > maxTotal) maxTotal = total
    sumTotal += total
    return { employeeId: e.id, name: e.name, color: e.color, counts: c, total, hours, byDay: byDay.get(e.id)! }
  })

  return {
    rows,
    maxTotal: Math.max(1, maxTotal),
    maxBucket: Math.max(1, maxBucket),
    avgTotal: rows.length > 0 ? sumTotal / rows.length : 0,
    bucketTotals,
  }
}
