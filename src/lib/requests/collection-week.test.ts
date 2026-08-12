import { describe, it, expect } from 'vitest'
import { pickCollectionWeek } from './collection-week'

// Sundays: 2026-08-16, 2026-08-23, 2026-08-30, ...
const first = '2026-08-16'
const today = '2026-08-12'
const never = () => false

describe('pickCollectionWeek', () => {
  it('returns the first upcoming week when nothing rolls', () => {
    const r = pickCollectionWeek({
      firstWeek: first,
      todayISO: today,
      statusByWeek: {},
      hasDeadline: false,
      deadlinePassed: never,
    })
    expect(r).toEqual({ weekStart: first, status: 'collecting' })
  })

  it('rolls past a published week when no deadline is configured', () => {
    const r = pickCollectionWeek({
      firstWeek: first,
      todayISO: today,
      statusByWeek: { [first]: 'published', '2026-08-23': 'locked' },
      hasDeadline: false,
      deadlinePassed: never,
    })
    expect(r).toEqual({ weekStart: '2026-08-23', status: 'locked' })
  })

  it('with a deadline, rolls only once the deadline passed — even if published early', () => {
    const r = pickCollectionWeek({
      firstWeek: first,
      todayISO: today,
      statusByWeek: { [first]: 'published' },
      hasDeadline: true,
      deadlinePassed: () => false,
    })
    expect(r).toEqual({ weekStart: first, status: 'published' })
  })

  it('with a deadline, rolls past a week whose deadline passed', () => {
    const r = pickCollectionWeek({
      firstWeek: first,
      todayISO: today,
      statusByWeek: {},
      hasDeadline: true,
      deadlinePassed: (wk) => wk === first,
    })
    expect(r).toEqual({ weekStart: '2026-08-23', status: 'collecting' })
  })

  it('rolls past a week that already started', () => {
    const r = pickCollectionWeek({
      firstWeek: '2026-08-09',
      todayISO: '2026-08-12',
      statusByWeek: {},
      hasDeadline: false,
      deadlinePassed: never,
    })
    expect(r.weekStart).toBe('2026-08-16')
  })

  it('caps at 8 candidates and returns the last one when everything rolls', () => {
    const r = pickCollectionWeek({
      firstWeek: first,
      todayISO: today,
      statusByWeek: {},
      hasDeadline: true,
      deadlinePassed: () => true,
    })
    expect(r.weekStart).toBe('2026-10-04') // first + 7 weeks
  })
})
