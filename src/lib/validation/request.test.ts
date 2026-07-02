import { describe, it, expect } from 'vitest'
import { saveDayRequestSchema, addVacationSchema, managerAddVacationSchema } from './request'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'
const uuid2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

describe('saveDayRequestSchema', () => {
  const base = {
    periodId: validUUID,
    employeeId: validUUID,
    dayOfWeek: 0,
    isOff: false,
    preferredShiftIds: [],
  }

  it('accepts a valid day-off request', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, isOff: true })
    expect(result.success).toBe(true)
  })

  it('accepts a valid preferred-shift request', () => {
    const result = saveDayRequestSchema.safeParse({
      ...base,
      preferredShiftIds: [validUUID, uuid2],
    })
    expect(result.success).toBe(true)
  })

  it('rejects dayOfWeek < 0', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, dayOfWeek: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects dayOfWeek > 6', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, dayOfWeek: 7 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid periodId UUID', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, periodId: 'bad' })
    expect(result.success).toBe(false)
  })

  it('rejects preferredShiftIds with non-UUID entries', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, preferredShiftIds: ['not-a-uuid'] })
    expect(result.success).toBe(false)
  })
})

describe('addVacationSchema', () => {
  it('accepts valid date range', () => {
    const result = addVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    })
    expect(result.success).toBe(true)
  })

  it('accepts same-day range (dateFrom === dateTo)', () => {
    const result = addVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-06-01',
      dateTo: '2026-06-01',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when dateTo is before dateFrom', () => {
    const result = addVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-06-07',
      dateTo: '2026-06-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue.message).toMatch(/תאריך/)
    }
  })

  it('rejects invalid date format', () => {
    const result = addVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: 'not-a-date',
      dateTo: '2026-06-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid employeeId UUID', () => {
    const result = addVacationSchema.safeParse({
      employeeId: 'bad',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    })
    expect(result.success).toBe(false)
  })
})

describe('managerAddVacationSchema', () => {
  it('accepts a valid vacation range and defaults kind to vacation', () => {
    const result = managerAddVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-07-01',
      dateTo: '2026-07-07',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.kind).toBe('vacation')
  })

  it('accepts an explicit miluim kind', () => {
    const result = managerAddVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-07-01',
      dateTo: '2026-07-07',
      kind: 'miluim',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.kind).toBe('miluim')
  })

  it('rejects an unknown kind', () => {
    const result = managerAddVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-07-01',
      dateTo: '2026-07-07',
      kind: 'sick',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when dateTo is before dateFrom, with the manager-facing message', () => {
    const result = managerAddVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-07-07',
      dateTo: '2026-07-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('תאריך סיום לפני תאריך התחלה')
    }
  })

  it('rejects invalid employeeId UUID', () => {
    const result = managerAddVacationSchema.safeParse({
      employeeId: 'bad',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-07',
    })
    expect(result.success).toBe(false)
  })
})
