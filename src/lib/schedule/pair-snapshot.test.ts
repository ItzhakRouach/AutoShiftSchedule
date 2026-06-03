import { describe, it, expect } from 'vitest'
import { buildPairSnapshot, type DaySnapshotRow } from './pair-snapshot'
import type { ShiftId } from '@/lib/domain/constants'

// Stub keyById map — base shift keys only (matches what the action passes).
const keyById: Record<string, ShiftId> = {
  st_morning: 'morning',
  st_noon: 'noon',
  st_night: 'night',
}

const row = (
  employee_id: string,
  shift_type_id: string,
  role_id: string,
  source = 'auto',
): DaySnapshotRow => ({ employee_id, shift_type_id, role_id, source })

describe('buildPairSnapshot', () => {
  it('keeps the night-person’s EXISTING role (bug 1) — מוקדן stays מוקדן', () => {
    // Day rows: morning AHMS = m, noon AHMS = c, night MOKED = n.
    const dayRows = [
      row('m', 'st_morning', 'ahms'),
      row('c', 'st_noon', 'ahms'),
      row('n', 'st_night', 'moked'),
    ]
    const out = buildPairSnapshot({
      dayRows, keyById,
      morningEmployeeId: 'm', nightEmployeeId: 'n',
      roleId: 'ahms', noonToRemove: ['c'], fallbackRoleId: 'ahms',
    })
    expect(out.morningRoleId).toBe('ahms')
    expect(out.nightRoleId).toBe('moked') // ← the bug-1 fix: night role preserved
  })

  it('snapshots morning row, night row, and noon-to-remove row', () => {
    const dayRows = [
      row('m', 'st_morning', 'ahms'),
      row('c', 'st_noon', 'ahms'),
      row('n', 'st_night', 'moked'),
    ]
    const out = buildPairSnapshot({
      dayRows, keyById,
      morningEmployeeId: 'm', nightEmployeeId: 'n',
      roleId: 'ahms', noonToRemove: ['c'], fallbackRoleId: 'ahms',
    })
    expect(out.snapshot).toEqual([
      row('m', 'st_morning', 'ahms'),
      row('n', 'st_night', 'moked'),
      row('c', 'st_noon', 'ahms'),
    ])
  })

  it('falls back to the chosen role when the employee has no current row', () => {
    // Night person 'n' has no current night assignment that day → fallback to roleId.
    const dayRows = [row('m', 'st_morning', 'ahms')]
    const out = buildPairSnapshot({
      dayRows, keyById,
      morningEmployeeId: 'm', nightEmployeeId: 'n',
      roleId: 'ahms', noonToRemove: [], fallbackRoleId: 'ahms',
    })
    expect(out.morningRoleId).toBe('ahms')
    expect(out.nightRoleId).toBe('ahms')
    // Only the morning row is in the snapshot — nothing else to restore.
    expect(out.snapshot).toEqual([row('m', 'st_morning', 'ahms')])
  })

  it('does not duplicate when the same row would be pushed twice', () => {
    const dayRows = [row('m', 'st_morning', 'ahms')]
    const out = buildPairSnapshot({
      dayRows, keyById,
      morningEmployeeId: 'm', nightEmployeeId: 'm', // same id (degenerate; UI also blocks)
      roleId: 'ahms', noonToRemove: [], fallbackRoleId: 'ahms',
    })
    expect(out.snapshot.length).toBe(1)
  })

  it('omits noon rows whose employee is not assigned to the chosen role at noon', () => {
    const dayRows = [
      row('m', 'st_morning', 'ahms'),
      row('c', 'st_noon', 'moked'), // different role
      row('n', 'st_night', 'ahms'),
    ]
    const out = buildPairSnapshot({
      dayRows, keyById,
      morningEmployeeId: 'm', nightEmployeeId: 'n',
      roleId: 'ahms', noonToRemove: ['c'], fallbackRoleId: 'ahms',
    })
    // 'c' is מוקדן at noon, not אחמש → no matching row found → not snapshotted.
    expect(out.snapshot.some((r) => r.employee_id === 'c')).toBe(false)
  })
})
