/**
 * Acceptance tests against four real weeks of one workplace (worker ids
 * anonymised to letters). The owner rebuilt most of each week by hand and
 * reached full coverage every time; these tests hold the engine to that.
 * See docs/superpowers/plans/2026-11-14-engine-owner-rules.md.
 *
 * A criterion the engine does not meet yet is listed in KNOWN_GAPS and runs as
 * `it.fails`, so the suite stays green AND goes red the moment a phase closes
 * the gap — at which point the entry is deleted.
 */
import { describe, it, expect } from 'vitest'
import w1115 from './2026-11-15.json'
import w1108 from './2026-11-08.json'
import w1101 from './2026-11-01.json'
import w1025 from './2026-10-25.json'
import { ownerRoleBreaks, scoreEngine, scoreManager, type RealWeek } from './metrics'

const WEEKS = [w1115, w1108, w1101, w1025] as unknown as RealWeek[]

/** `${week}:${criterion}` the current engine is known to miss. */
const KNOWN_GAPS = new Set<string>([
  // After phase 1 (12h pairing + safe displacement) and the owner-confirmed
  // availability fix: every week fully covered; nights remain.
  '2026-11-15:night-spread', '2026-11-15:night-max',
])

const check = (week: string, criterion: string) => (KNOWN_GAPS.has(`${week}:${criterion}`) ? it.fails : it)

describe.each(WEEKS)('real week $week', (week) => {
  const engine = scoreEngine(week)
  const manager = scoreManager(week)

  it('the published schedule itself is fully and honestly covered (fixture sanity)', () => {
    expect(manager.openCells).toBe(0)
    expect(manager.eveningShort).toBe(0)
  })

  // The owner filled a few cells with someone outside their role; the engine
  // must never do that (owner decision 2026-11-14), so those may stay open.
  check(week.week, 'coverage')('covers every cell the owner covered without breaking a role', () => {
    expect(engine.openCells).toBeLessThanOrEqual(ownerRoleBreaks(week))
  })

  check(week.week, 'evening')('never leaves 19:00–23:00 short behind a "covered" noon cell', () => {
    expect(engine.eveningShort).toBe(0)
  })

  check(week.week, 'twelve')('uses no more 12h shifts than the owner needed', () => {
    expect(engine.twelveCount).toBeLessThanOrEqual(manager.twelveCount)
  })

  // The ±1 rule itself is proven on synthetic rosters (night-* tests). On a real
  // week, requests and availability can make it unreachable — the owner's own
  // split is the bar there.
  check(week.week, 'night-spread')('splits nights no wider than the owner did', () => {
    expect(engine.nightSpread).toBeLessThanOrEqual(manager.nightSpread)
  })

  check(week.week, 'night-max')('gives nobody more nights than the owner gave anyone', () => {
    expect(engine.nightMax).toBeLessThanOrEqual(manager.nightMax)
  })

  check(week.week, 'requests')('honours at least as many requests as the owner did, minus two', () => {
    expect(engine.requestsHonoured).toBeGreaterThanOrEqual(manager.requestsHonoured - 2)
  })
})
