import { describe, it, expect } from 'vitest'
import { validateAssignmentCore, type ValidateCoreArgs } from './validate-edit-core'
import type { Employee, DayMeta, Settings, DayRequest } from '@/lib/scheduling/types'

const emp: Employee = {
  id: 'e1',
  roleIds: ['מאבטח'],
  employmentType: 'full',
  minShifts: 0,
  maxShifts: 5,
  observesShabbat: false,
  observesHolidays: false,
  mustAccept: false,
  availability: null, // unrestricted
}
const meta: DayMeta = { index: 2, isHolidayEve: false, isHoliday: false }
const settings: Settings = { minRestHours: 8, idealRestHours: 16, allow12hFallback: true }
const noReq: DayRequest = { off: false, preferred: [] }

function args(over: Partial<ValidateCoreArgs> = {}): ValidateCoreArgs {
  return { emp, meta, shiftKey: 'morning', roleId: 'מאבטח', request: noReq, others: [], settings, ...over }
}

describe('validateAssignmentCore', () => {
  it('accepts a legal base assignment (soft when not requested)', () => {
    const v = validateAssignmentCore(args())
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.severity).toBe('soft')
  })

  it('marks requested shift as ok without soft', () => {
    const v = validateAssignmentCore(args({ request: { off: false, preferred: ['morning'] } }))
    expect(v).toEqual({ ok: true })
  })

  it('rejects wrong role', () => {
    const v = validateAssignmentCore(args({ roleId: 'מוקדן' }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('תפקיד')
  })

  it('rejects when off', () => {
    const v = validateAssignmentCore(args({ request: { off: true, preferred: [] } }))
    expect(v.ok).toBe(false)
  })

  it('rejects when unavailable (restricted profile)', () => {
    const restricted: Employee = { ...emp, availability: { 2: ['night'] } }
    const v = validateAssignmentCore(args({ emp: restricted, shiftKey: 'morning' }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('זמין')
  })

  it('rejects one-shift-per-day (other slot same day)', () => {
    const v = validateAssignmentCore(args({ others: [{ day: 2, shiftKey: 'night', roleId: 'מאבטח' }] }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('אחרת')
  })

  it('rejects max shifts', () => {
    const capped: Employee = { ...emp, maxShifts: 1 }
    const v = validateAssignmentCore(
      args({ emp: capped, others: [{ day: 0, shiftKey: 'morning', roleId: 'מאבטח' }] }),
    )
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('מקסימום')
  })

  it('rejects a base rest violation (night then next morning)', () => {
    // night day1 ends 07:00 day2; morning day2 starts 07:00 → 0h rest < 8.
    const v = validateAssignmentCore(
      args({ meta: { index: 2, isHolidayEve: false, isHoliday: false }, shiftKey: 'morning', others: [{ day: 1, shiftKey: 'night', roleId: 'מאבטח' }] }),
    )
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('מנוחה')
  })

  it('rejects a 12h rest violation (m12_day overlaps next-day morning)', () => {
    // m12_day day2 = 07:00–19:00 day2. A committed shift day3 morning 07:00 →
    // gap 12h ok. Use day2 noon (15:00) committed → overlaps the 12h block.
    const v = validateAssignmentCore(
      args({ shiftKey: 'm12_day', isTwelveHour: true, others: [{ day: 1, shiftKey: 'night', roleId: 'מאבטח' }] }),
    )
    // night day1 = 23:00 day1–07:00 day2; m12_day day2 starts 07:00 → 0h gap.
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('מנוחה')
  })

  it('accepts a 12h shift with adequate rest', () => {
    const v = validateAssignmentCore(
      args({ shiftKey: 'm12_day', isTwelveHour: true, others: [{ day: 0, shiftKey: 'morning', roleId: 'מאבטח' }] }),
    )
    expect(v.ok).toBe(true)
  })
})
