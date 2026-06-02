import { describe, it, expect } from 'vitest'
import { summarizeEmployee, shiftTypeOrder, type SummaryAssignment, type SummaryRequest } from './employee-summary'

const shiftKeyById = new Map([
  ['st-morning', 'morning'],
  ['st-noon', 'noon'],
  ['st-night', 'night'],
  ['st-12day', 'm12_day'],
])
const roleNameById = new Map([
  ['r-ahmash', 'אחמ״ש'],
  ['r-moked', 'מוקדן'],
  ['r-maabtach', 'מאבטח'],
])

describe('summarizeEmployee', () => {
  it('counts totals, by role, and by shift type', () => {
    const assignments: SummaryAssignment[] = [
      { day_of_week: 0, shift_type_id: 'st-morning', role_id: 'r-moked' },
      { day_of_week: 1, shift_type_id: 'st-night', role_id: 'r-maabtach' },
      { day_of_week: 2, shift_type_id: 'st-morning', role_id: 'r-ahmash' },
    ]
    const s = summarizeEmployee(assignments, [], shiftKeyById, roleNameById)
    expect(s.total).toBe(3)
    expect(s.byShiftType['בוקר']).toBe(2)
    expect(s.byShiftType['לילה']).toBe(1)
    expect(s.byShiftType['צהריים']).toBe(0)
    expect(s.byRole['מוקדן']).toBe(1)
    expect(s.byRole['מאבטח']).toBe(1)
    expect(s.byRole['אחמ״ש']).toBe(1)
  })

  it('groups 12h variants under "12 שעות"', () => {
    const assignments: SummaryAssignment[] = [
      { day_of_week: 0, shift_type_id: 'st-12day', role_id: 'r-maabtach' },
    ]
    const s = summarizeEmployee(assignments, [], shiftKeyById, roleNameById)
    expect(s.byShiftType['12 שעות']).toBe(1)
    expect(s.total).toBe(1)
  })

  it('counts honored vs requested (match on day + preferred shift)', () => {
    const assignments: SummaryAssignment[] = [
      { day_of_week: 0, shift_type_id: 'st-morning', role_id: 'r-moked' },
      { day_of_week: 1, shift_type_id: 'st-night', role_id: 'r-maabtach' },
    ]
    const requests: SummaryRequest[] = [
      { day_of_week: 0, is_off: false, preferred_shift_ids: ['st-morning'] }, // honored
      { day_of_week: 1, is_off: false, preferred_shift_ids: ['st-morning'] }, // requested, not honored
      { day_of_week: 3, is_off: true, preferred_shift_ids: [] }, // day-off, ignored
      { day_of_week: 4, is_off: false, preferred_shift_ids: [] }, // empty, ignored
    ]
    const s = summarizeEmployee(assignments, requests, shiftKeyById, roleNameById)
    expect(s.requestedCount).toBe(2)
    expect(s.honoredCount).toBe(1)
  })

  it('shiftTypeOrder keeps base order then extras', () => {
    expect(shiftTypeOrder({ בוקר: 1, צהריים: 0, לילה: 2, '12 שעות': 1 })).toEqual([
      'בוקר', 'צהריים', 'לילה', '12 שעות',
    ])
  })
})
