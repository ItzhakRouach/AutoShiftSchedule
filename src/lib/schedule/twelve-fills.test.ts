import { describe, it, expect } from 'vitest'
import {
  buildEngineTwelveFills,
  buildManualTwelveFills,
  parseTwelveFills,
} from './twelve-fills'

const nameToRoleId: Record<string, string> = {
  'אחמ"ש': 'role-ahmash',
  מוקדן: 'role-mokdan',
  מאבטח: 'role-mavtach',
}

describe('buildEngineTwelveFills', () => {
  it('maps a cross-role m12_day plan to two fills in FILLS order', () => {
    const fills = buildEngineTwelveFills(
      'm12_day',
      { morning: 'מוקדן', noon: 'אחמ"ש' },
      nameToRoleId,
    )
    expect(fills).toEqual([
      { shift: 'morning', role_id: 'role-mokdan' },
      { shift: 'noon', role_id: 'role-ahmash' },
    ])
  })

  it('maps a single-role m12_night plan to one fill', () => {
    const fills = buildEngineTwelveFills('m12_night', { night: 'מאבטח' }, nameToRoleId)
    expect(fills).toEqual([{ shift: 'night', role_id: 'role-mavtach' }])
  })

  it('drops an unresolvable role but keeps the resolvable one', () => {
    const fills = buildEngineTwelveFills(
      'm12_day',
      { morning: 'מוקדן', noon: 'לא קיים' },
      nameToRoleId,
    )
    expect(fills).toEqual([{ shift: 'morning', role_id: 'role-mokdan' }])
  })

  it('returns null when every role is unresolvable', () => {
    const fills = buildEngineTwelveFills(
      'm12_day',
      { morning: 'לא קיים', noon: 'גם לא' },
      nameToRoleId,
    )
    expect(fills).toBeNull()
  })

  it('returns null when rolesByShift has no entry for any FILLS shift', () => {
    const fills = buildEngineTwelveFills('m12_night', {}, nameToRoleId)
    expect(fills).toBeNull()
  })

  it('maps m12_3to15 (night+morning) preserving FILLS order', () => {
    const fills = buildEngineTwelveFills(
      'm12_3to15',
      { morning: 'אחמ"ש', night: 'מוקדן' },
      nameToRoleId,
    )
    expect(fills).toEqual([
      { shift: 'night', role_id: 'role-mokdan' },
      { shift: 'morning', role_id: 'role-ahmash' },
    ])
  })
})

describe('buildManualTwelveFills', () => {
  it('expands m12_day into two entries (morning + noon) under the single role', () => {
    const fills = buildManualTwelveFills('m12_day', 'role-mokdan')
    expect(fills).toEqual([
      { shift: 'morning', role_id: 'role-mokdan' },
      { shift: 'noon', role_id: 'role-mokdan' },
    ])
  })

  it('expands m12_night into a single entry (night) under the role', () => {
    const fills = buildManualTwelveFills('m12_night', 'role-mavtach')
    expect(fills).toEqual([{ shift: 'night', role_id: 'role-mavtach' }])
  })

  it('expands m12_15to3 into two entries (noon + night)', () => {
    const fills = buildManualTwelveFills('m12_15to3', 'role-ahmash')
    expect(fills).toEqual([
      { shift: 'noon', role_id: 'role-ahmash' },
      { shift: 'night', role_id: 'role-ahmash' },
    ])
  })

  it('expands m12_3to15 into two entries (night + morning)', () => {
    const fills = buildManualTwelveFills('m12_3to15', 'role-mokdan')
    expect(fills).toEqual([
      { shift: 'night', role_id: 'role-mokdan' },
      { shift: 'morning', role_id: 'role-mokdan' },
    ])
  })
})

describe('parseTwelveFills', () => {
  it('returns null for null input', () => {
    expect(parseTwelveFills(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(parseTwelveFills(undefined)).toBeNull()
  })

  it('returns null for a non-array value', () => {
    expect(parseTwelveFills({ shift: 'morning', role_id: 'x' })).toBeNull()
  })

  it('returns null for an array of garbage objects', () => {
    expect(parseTwelveFills([{ foo: 'bar' }, 42, 'nope'])).toBeNull()
  })

  it('returns null for an array with an invalid shift value', () => {
    expect(parseTwelveFills([{ shift: 'afternoon', role_id: 'role-1' }])).toBeNull()
  })

  it('returns null for an array with a missing role_id', () => {
    expect(parseTwelveFills([{ shift: 'morning' }])).toBeNull()
  })

  it('returns null for an empty array', () => {
    expect(parseTwelveFills([])).toBeNull()
  })

  it('round-trips a valid fills array', () => {
    const valid = [
      { shift: 'morning', role_id: 'role-mokdan' },
      { shift: 'noon', role_id: 'role-ahmash' },
    ]
    expect(parseTwelveFills(valid)).toEqual(valid)
  })
})
