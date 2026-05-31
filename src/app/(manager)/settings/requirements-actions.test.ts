import { describe, it, expect } from 'vitest'
import { buildRows } from './requirements-utils'

describe('buildRows', () => {
  const WP_ID = 'wp-00000000-0000-0000-0000-000000000001'
  const SHIFT_ID = 'st-00000000-0000-0000-0000-000000000002'
  const ROLE_ID = 'ro-00000000-0000-0000-0000-000000000003'

  it('produces exactly 7 rows for a single (shift, role) pair', () => {
    const rows = buildRows(WP_ID, { shiftTypeId: SHIFT_ID, roleId: ROLE_ID, count: 2 })
    expect(rows).toHaveLength(7)
  })

  it('each row has count equal to the input count', () => {
    const rows = buildRows(WP_ID, { shiftTypeId: SHIFT_ID, roleId: ROLE_ID, count: 2 })
    for (const row of rows) {
      expect(row.count).toBe(2)
    }
  })

  it('covers day_of_week 0 through 6', () => {
    const rows = buildRows(WP_ID, { shiftTypeId: SHIFT_ID, roleId: ROLE_ID, count: 3 })
    const days = rows.map((r) => r.day_of_week).sort()
    expect(days).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('carries correct workplace_id, shift_type_id, role_id', () => {
    const rows = buildRows(WP_ID, { shiftTypeId: SHIFT_ID, roleId: ROLE_ID, count: 1 })
    for (const row of rows) {
      expect(row.workplace_id).toBe(WP_ID)
      expect(row.shift_type_id).toBe(SHIFT_ID)
      expect(row.role_id).toBe(ROLE_ID)
    }
  })

  it('count=0 still produces 7 rows with count 0', () => {
    const rows = buildRows(WP_ID, { shiftTypeId: SHIFT_ID, roleId: ROLE_ID, count: 0 })
    expect(rows).toHaveLength(7)
    expect(rows.every((r) => r.count === 0)).toBe(true)
  })

  it('count=6 (max) is preserved', () => {
    const rows = buildRows(WP_ID, { shiftTypeId: SHIFT_ID, roleId: ROLE_ID, count: 6 })
    expect(rows.every((r) => r.count === 6)).toBe(true)
  })
})
