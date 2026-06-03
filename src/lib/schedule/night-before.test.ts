import { describe, it, expect } from 'vitest'
import { buildNightBeforeByDay, toSerializable } from './night-before'
import type { ShiftId } from '@/lib/domain/constants'

const day = (entries: Array<[string, ShiftId]>) =>
  entries.map(([employeeId, shiftKey]) => ({ employeeId, shiftKey }))

describe('buildNightBeforeByDay', () => {
  it('marks D when employee worked night on D-1 (within week)', () => {
    const byDay = new Map([[2, day([['e1', 'night']])]])
    const r = buildNightBeforeByDay({ byDay, priorWeekTail: {} })
    expect(r[3].has('e1')).toBe(true)
    expect(r[2].has('e1')).toBe(false) // not the same day, only the next
  })

  it('marks D when employee was on m12_night on D-1 (19→07 wraps)', () => {
    const byDay = new Map([[4, day([['e1', 'm12_night']])]])
    const r = buildNightBeforeByDay({ byDay, priorWeekTail: {} })
    expect(r[5].has('e1')).toBe(true)
  })

  it('marks D when employee was on m12_15to3 on D-1 (15→03 wraps)', () => {
    const byDay = new Map([[1, day([['e1', 'm12_15to3']])]])
    const r = buildNightBeforeByDay({ byDay, priorWeekTail: {} })
    expect(r[2].has('e1')).toBe(true)
  })

  it('does NOT mark D for daytime shifts on D-1 (morning, noon, m12_day, m12_3to15)', () => {
    const byDay = new Map([
      [1, day([
        ['e1', 'morning'],   // 07–15 → ends day 1 hour 15 < 48
        ['e2', 'noon'],      // 15–23 → ends day 1 hour 23 < 48
        ['e3', 'm12_day'],   // 07–19 → ends day 1 hour 19 < 48
        ['e4', 'm12_3to15'], // 03–15 → ends day 1 hour 15 < 48
      ])],
    ])
    const r = buildNightBeforeByDay({ byDay, priorWeekTail: {} })
    expect(r[2].size).toBe(0)
  })

  it('marks day 0 when employee has a prior-week-tail end abs > 0 (overnight from prior Sat)', () => {
    const r = buildNightBeforeByDay({ byDay: new Map(), priorWeekTail: { e1: [7], e2: [-1] } })
    expect(r[0].has('e1')).toBe(true)
    expect(r[0].has('e2')).toBe(false) // ends at -1, doesn't wrap into current week
  })

  it('does not wrap Saturday-of-current-week night into anything (week ends at 6)', () => {
    // Saturday night extends into next Sunday — that's a future week, not modelled.
    const byDay = new Map([[6, day([['e1', 'night']])]])
    const r = buildNightBeforeByDay({ byDay, priorWeekTail: {} })
    expect(Object.values(r).every((s) => !s.has('e1'))).toBe(true)
  })

  it('toSerializable converts Sets → arrays for client transport', () => {
    const out = toSerializable({ 0: new Set(['e1', 'e2']), 1: new Set(), 2: new Set(['e3']), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() })
    expect(out[0].sort()).toEqual(['e1', 'e2'])
    expect(out[2]).toEqual(['e3'])
    expect(out[3]).toEqual([])
  })
})
