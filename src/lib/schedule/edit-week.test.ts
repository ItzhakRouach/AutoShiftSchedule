import { describe, it, expect } from 'vitest'
import { pickEditWeek } from './edit-week'
import { pickCollectionWeek } from '@/lib/requests/collection-week'

// firstWeek used throughout: 2026-06-07 is a Sunday.
const W0 = '2026-06-07'
const W1 = '2026-06-14'
const W2 = '2026-06-21'
const W7 = '2026-07-26' // last of the 8 candidates

describe('pickEditWeek', () => {
  it('stays on the first week when it has no period row yet', () => {
    expect(pickEditWeek({ firstWeek: W0, statusByWeek: {} })).toEqual({
      weekStart: W0,
      rolledPast: [],
    })
  })

  it('stays on a collecting week', () => {
    expect(pickEditWeek({ firstWeek: W0, statusByWeek: { [W0]: 'collecting' } })).toEqual({
      weekStart: W0,
      rolledPast: [],
    })
  })

  it('stays on a LOCKED week — locked is the manager-working phase', () => {
    expect(pickEditWeek({ firstWeek: W0, statusByWeek: { [W0]: 'locked' } })).toEqual({
      weekStart: W0,
      rolledPast: [],
    })
  })

  it('rolls past a published first week (the reported bug)', () => {
    expect(pickEditWeek({ firstWeek: W0, statusByWeek: { [W0]: 'published' } })).toEqual({
      weekStart: W1,
      rolledPast: [W0],
    })
  })

  it('rolls past two consecutive published weeks', () => {
    expect(
      pickEditWeek({ firstWeek: W0, statusByWeek: { [W0]: 'published', [W1]: 'published' } }),
    ).toEqual({ weekStart: W2, rolledPast: [W0, W1] })
  })

  it('lands on a locked week after a published one', () => {
    expect(
      pickEditWeek({ firstWeek: W0, statusByWeek: { [W0]: 'published', [W1]: 'locked' } }),
    ).toEqual({ weekStart: W1, rolledPast: [W0] })
  })

  it('degenerate: all 8 candidates published → returns the last one', () => {
    const statusByWeek: Record<string, string> = {}
    for (let i = 0; i < 8; i++) {
      const [y, m, d] = W0.split('-').map(Number)
      const wk = new Date(y, m - 1, d + i * 7)
      const iso = `${wk.getFullYear()}-${String(wk.getMonth() + 1).padStart(2, '0')}-${String(wk.getDate()).padStart(2, '0')}`
      statusByWeek[iso] = 'published'
    }
    const res = pickEditWeek({ firstWeek: W0, statusByWeek })
    expect(res.weekStart).toBe(W7)
    expect(res.rolledPast).toHaveLength(7)
  })

  it('agrees with the employee resolver when the upcoming week is published (no deadline)', () => {
    // The reported bug scenario: upcoming week published before it starts.
    // Manager (pickEditWeek) and employee (pickCollectionWeek) must land on the
    // SAME next week so both sides collect requests for it.
    const manager = pickEditWeek({ firstWeek: W0, statusByWeek: { [W0]: 'published' } })
    const employee = pickCollectionWeek({
      firstWeek: W0,
      todayISO: '2026-06-03', // Wednesday before W0
      statusByWeek: { [W0]: 'published' },
      hasDeadline: false,
      deadlinePassed: () => false,
    })
    expect(manager.weekStart).toBe(employee.weekStart)
    expect(manager.weekStart).toBe(W1)
  })
})
