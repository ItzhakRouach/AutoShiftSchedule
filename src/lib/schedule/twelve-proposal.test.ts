import { describe, it, expect } from 'vitest'
import { buildTwelveProposal, type ProposalRow } from './twelve-proposal'
import type { Requirements } from '@/lib/scheduling/types'

// One day, one role per shift. st-* are shift_type ids, r-g the guard role id.
const idToKey = { 'st-m': 'morning', 'st-n': 'noon', 'st-l': 'night', 'st-d': 'm12_day', 'st-x': 'm12_night' }
const roleIdToName = { 'r-g': 'מאבטח' }
const req: Requirements = { 0: { morning: { מאבטח: 1 }, noon: { מאבטח: 1 }, night: { מאבטח: 1 } } }
const names = { a: 'דנה', b: 'יוסי', c: 'מאיה' }
const row = (employee_id: string, shift_type_id: string, day = 0, extra: Partial<ProposalRow> = {}): ProposalRow =>
  ({ employee_id, day_of_week: day, shift_type_id, role_id: 'r-g', ...extra })

describe('buildTwelveProposal', () => {
  it('a morning + night day becomes a 07–19 / 19–07 pair and closes the noon gap', () => {
    const before = [row('a', 'st-m'), row('b', 'st-l')]
    const after = [
      row('a', 'st-d', 0, { twelve_fills: [{ shift: 'morning', role_id: 'r-g' }, { shift: 'noon', role_id: 'r-g' }] }),
      row('b', 'st-x', 0, { twelve_fills: [{ shift: 'night', role_id: 'r-g' }] }),
    ]
    const p = buildTwelveProposal({ before, after, requirements: req, idToKey, roleIdToName, names, overrides: [] })
    expect(p.openBefore).toBe(1)
    expect(p.openAfter).toBe(0)
    expect(p.twelveCount).toBe(2)
    expect(p.days).toHaveLength(1)
    expect(p.days[0].pairs).toEqual([
      { employeeId: 'a', name: 'דנה', variant: 'm12_day', roles: ['מאבטח'] },
      { employeeId: 'b', name: 'יוסי', variant: 'm12_night', roles: ['מאבטח'] },
    ])
    expect(p.days[0].changes).toEqual([
      { employeeId: 'a', name: 'דנה', from: 'morning', to: 'm12_day' },
      { employeeId: 'b', name: 'יוסי', from: 'night', to: 'm12_night' },
    ])
  })

  it('lists workers who move, join or leave a day, and day-off overrides', () => {
    const before = [row('a', 'st-m'), row('b', 'st-n')]
    const after = [row('a', 'st-m'), row('b', 'st-l'), row('c', 'st-n')]
    const p = buildTwelveProposal({
      before, after, requirements: req, idToKey, roleIdToName, names,
      overrides: [{ employeeId: 'c', day: 0, shift: 'noon', roleId: 'מאבטח' }],
    })
    expect(p.openAfter).toBe(0)
    expect(p.days[0].changes).toEqual([
      { employeeId: 'b', name: 'יוסי', from: 'noon', to: 'night' },
      { employeeId: 'c', name: 'מאיה', from: null, to: 'noon' },
    ])
    expect(p.days[0].overrides).toEqual([{ employeeId: 'c', name: 'מאיה', shift: 'noon' }])
  })

  it('days with no change are left out', () => {
    const rows = [row('a', 'st-m'), row('b', 'st-n'), row('c', 'st-l')]
    const p = buildTwelveProposal({ before: rows, after: rows, requirements: req, idToKey, roleIdToName, names, overrides: [] })
    expect(p.days).toEqual([])
    expect(p.openBefore).toBe(0)
  })

  it('a 12h row without a stored fill plan covers its default windows', () => {
    const p = buildTwelveProposal({
      before: [], after: [row('a', 'st-d'), row('b', 'st-x')],
      requirements: req, idToKey, roleIdToName, names, overrides: [],
    })
    expect(p.openBefore).toBe(3)
    expect(p.openAfter).toBe(0)
  })
})
