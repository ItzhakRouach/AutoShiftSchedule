import { describe, it, expect } from 'vitest'
import { summarizeWeekInWork, type WeekInWorkInput } from './week-in-work'

const base: WeekInWorkInput = {
  weekStart: '2026-11-15',
  shiftTypes: [
    { id: 'st-m', key: 'morning', is_fallback: false },
    { id: 'st-n', key: 'noon', is_fallback: false },
    { id: 'st-12', key: 'm12_day', is_fallback: true },
  ],
  requirements: [
    { day_of_week: 0, shift_type_id: 'st-m', role_id: 'r1', count: 1 },
    { day_of_week: 0, shift_type_id: 'st-n', role_id: 'r1', count: 2 },
    { day_of_week: 1, shift_type_id: 'st-m', role_id: 'r1', count: 1 },
    { day_of_week: 1, shift_type_id: 'st-n', role_id: 'r1', count: 0 }, // not a target
  ],
  assignments: [],
  slotMarks: [],
  requests: [],
  employees: [
    { id: 'e1', name: 'אורי' },
    { id: 'e2', name: 'מאיה' },
    { id: 'e3', name: 'נועה' },
  ],
  deadline: null,
  nowMs: Date.parse('2026-11-13T10:00:00Z'),
}
const row = (employee_id: string, day_of_week: number, shift_type_id: string) =>
  ({ employee_id, day_of_week, shift_type_id, role_id: 'r1' })

describe('summarizeWeekInWork — schedule progress', () => {
  it('an empty week: every required cell is open, nothing assigned', () => {
    const s = summarizeWeekInWork(base)
    expect(s.totalCells).toBe(3)
    expect(s.openCells).toBe(3)
    expect(s.hasAssignments).toBe(false)
    expect(s.twelveCount).toBe(0)
  })

  it('a cell needing two people stays open until both are placed', () => {
    const one = summarizeWeekInWork({ ...base, assignments: [row('e1', 0, 'st-m'), row('e2', 0, 'st-n')] })
    expect(one.openCells).toBe(2) // day0 noon (1/2) + day1 morning
    const both = summarizeWeekInWork({ ...base, assignments: [row('e1', 0, 'st-m'), row('e2', 0, 'st-n'), row('e3', 0, 'st-n')] })
    expect(both.openCells).toBe(1)
    expect(both.hasAssignments).toBe(true)
  })

  it('a cell marked intentionally empty is not counted as open', () => {
    const s = summarizeWeekInWork({ ...base, slotMarks: [{ day_of_week: 1, shift_type_id: 'st-m', role_id: 'r1', label: 'חג' }] })
    expect(s.openCells).toBe(2)
  })

  it('counts 12h shifts', () => {
    const s = summarizeWeekInWork({ ...base, assignments: [row('e1', 0, 'st-12')] })
    expect(s.twelveCount).toBe(1)
  })
})

describe('summarizeWeekInWork — requests', () => {
  it('lists who has not submitted any request yet', () => {
    const s = summarizeWeekInWork({ ...base, requests: [{ employee_id: 'e2' }, { employee_id: 'e2' }] })
    expect(s.rosterCount).toBe(3)
    expect(s.submittedCount).toBe(1)
    expect(s.notSubmitted).toEqual(['אורי', 'נועה'])
  })

  it('reports the deadline and whether it has passed', () => {
    // Deadline = Thursday before the week (dow 4) at 18:00 Israel = 2026-11-12 16:00Z.
    const before = summarizeWeekInWork({ ...base, deadline: { dow: 4, time: '18:00:00', zone: 'Asia/Jerusalem' }, nowMs: Date.parse('2026-11-12T15:00:00Z') })
    expect(before.deadline).toEqual({ label: 'יום חמישי, 12.11 בשעה 18:00', passed: false })
    const after = summarizeWeekInWork({ ...base, deadline: { dow: 4, time: '18:00:00', zone: 'Asia/Jerusalem' }, nowMs: Date.parse('2026-11-12T17:00:00Z') })
    expect(after.deadline?.passed).toBe(true)
  })
})
