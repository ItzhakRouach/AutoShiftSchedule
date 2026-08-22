// Regression: the manager's history navigator must contain only weeks strictly
// BEFORE the editing week. A published FUTURE week (e.g. published two weeks
// ahead) used to land first in the history view, and stepping "שבוע קודם" from
// it hit the editing week — which renders the editor and dead-ends navigation.
import { describe, it, expect } from 'vitest'
import { pastPublishedWeeks, type PublishedWeek } from './published-view'

const wk = (id: string, weekStart: string): PublishedWeek => ({ id, weekStart, label: id })

describe('pastPublishedWeeks', () => {
  it('excludes the editing week and any published week after it', () => {
    // Editing 2026-08-23; 2026-08-30 is published ahead of time.
    const weeks = [
      wk('p0830', '2026-08-30'),
      wk('p0823', '2026-08-23'),
      wk('p0816', '2026-08-16'),
      wk('p0809', '2026-08-09'),
    ]
    expect(pastPublishedWeeks(weeks, '2026-08-23').map((w) => w.id)).toEqual(['p0816', 'p0809'])
  })

  it('returns empty when nothing precedes the editing week', () => {
    expect(pastPublishedWeeks([wk('p0823', '2026-08-23')], '2026-08-23')).toEqual([])
  })

  it('preserves newest-first order', () => {
    const weeks = [wk('p0816', '2026-08-16'), wk('p0809', '2026-08-09')]
    expect(pastPublishedWeeks(weeks, '2026-08-23').map((w) => w.id)).toEqual(['p0816', 'p0809'])
  })
})
