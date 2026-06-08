import { describe, it, expect } from 'vitest'
import { validateAssignmentCore, slotAtCapacity, type ValidateCoreArgs } from './validate-edit-core'
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

// Saturday = index 6
const satMeta: DayMeta = { index: 6, isHolidayEve: false, isHoliday: false }
// Wednesday = index 3 (no sacred overlap)
const wedMeta: DayMeta = { index: 3, isHolidayEve: false, isHoliday: false }

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

  // --- FIX 1: 12h Shabbat/holiday + availability ---

  it('blocks Shabbat-observer on m12_day (morning+noon) on Saturday', () => {
    // Saturday: morning & noon are both shabbat-blocked → m12_day must be rejected.
    const shabbatEmp: Employee = { ...emp, observesShabbat: true }
    const v = validateAssignmentCore(
      args({ emp: shabbatEmp, meta: satMeta, shiftKey: 'm12_day', isTwelveHour: true }),
    )
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('שבת')
  })

  it('allows Shabbat-observer on m12_day on a weekday with no overlap', () => {
    // Wednesday (index 3): no Shabbat block → m12_day is permitted.
    const shabbatEmp: Employee = { ...emp, observesShabbat: true }
    const v = validateAssignmentCore(
      args({ emp: shabbatEmp, meta: wedMeta, shiftKey: 'm12_day', isTwelveHour: true }),
    )
    expect(v.ok).toBe(true)
  })

  it('blocks availability-restricted employee on 12h whose covered shifts are not allowed', () => {
    // Employee allowed only night on day 3; m12_day covers morning+noon → blocked.
    const restricted: Employee = { ...emp, availability: { 3: ['night'] } }
    const v = validateAssignmentCore(
      args({ emp: restricted, meta: wedMeta, shiftKey: 'm12_day', isTwelveHour: true }),
    )
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('זמין')
  })

  it('allows availability-restricted employee on 12h when all covered shifts are permitted', () => {
    // Employee allowed morning+noon on day 3; m12_day covers exactly that.
    const permitted: Employee = { ...emp, availability: { 3: ['morning', 'noon'] } }
    const v = validateAssignmentCore(
      args({ emp: permitted, meta: wedMeta, shiftKey: 'm12_day', isTwelveHour: true }),
    )
    expect(v.ok).toBe(true)
  })

  // --- Cross-week rest (priorTail) ---

  it('blocks Sun-morning manual edit when prior Sat night ended at abs 7', () => {
    const sunMeta: DayMeta = { index: 0, isHolidayEve: false, isHoliday: false }
    const v = validateAssignmentCore(
      args({ meta: sunMeta, shiftKey: 'morning', priorTail: [7] }),
    )
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('שבוע הקודם')
  })

  it('allows Sun-noon edit even with a prior Sat night (8h gap meets default)', () => {
    const sunMeta: DayMeta = { index: 0, isHolidayEve: false, isHoliday: false }
    const v = validateAssignmentCore(
      args({ meta: sunMeta, shiftKey: 'noon', priorTail: [7] }),
    )
    expect(v.ok).toBe(true)
  })
})

describe('slotAtCapacity', () => {
  it('blocks adding a 2nd person to a 1-person role box', () => {
    expect(slotAtCapacity(1, 1)).toBe(true)
  })

  it('allows adding when below the required headcount', () => {
    expect(slotAtCapacity(0, 1)).toBe(false)
    expect(slotAtCapacity(1, 2)).toBe(false)
  })

  it('treats over-filled and exactly-full slots as at capacity', () => {
    expect(slotAtCapacity(2, 2)).toBe(true)
    expect(slotAtCapacity(3, 2)).toBe(true)
  })

  it('admits no one to a slot with zero requirement', () => {
    expect(slotAtCapacity(0, 0)).toBe(true)
  })
})
