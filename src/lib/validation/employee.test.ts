import { describe, it, expect } from 'vitest'
import { employeeSchema } from './employee'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'

const validInput = {
  name: 'ישראל ישראלי',
  phone: '050-1234567',
  minShifts: 3,
  observesShabbat: true,
  observesHolidays: false,
  mustAccept: false,
  roleIds: [validUUID],
}

describe('employeeSchema', () => {
  it('accepts a valid employee', () => {
    const result = employeeSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = employeeSchema.safeParse({ ...validInput, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name')
      expect(nameIssue).toBeTruthy()
    }
  })

  it('rejects name shorter than 2 characters', () => {
    const result = employeeSchema.safeParse({ ...validInput, name: 'א' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name')
      expect(nameIssue?.message).toContain('2 תווים')
    }
  })

  it('rejects name longer than 120 characters', () => {
    const result = employeeSchema.safeParse({ ...validInput, name: 'א'.repeat(121) })
    expect(result.success).toBe(false)
  })

  it('accepts empty phone', () => {
    const result = employeeSchema.safeParse({ ...validInput, phone: '' })
    expect(result.success).toBe(true)
  })

  it('accepts missing phone (undefined)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { phone: _omit, ...rest } = validInput
    const result = employeeSchema.safeParse(rest)
    expect(result.success).toBe(true)
  })

  it('rejects minShifts below 0', () => {
    const result = employeeSchema.safeParse({ ...validInput, minShifts: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'minShifts')
      expect(issue?.message).toContain('0')
    }
  })

  it('rejects minShifts above 7', () => {
    const result = employeeSchema.safeParse({ ...validInput, minShifts: 8 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'minShifts')
      expect(issue?.message).toContain('7')
    }
  })

  it('accepts minShifts of 0', () => {
    const result = employeeSchema.safeParse({ ...validInput, minShifts: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts minShifts of 7', () => {
    const result = employeeSchema.safeParse({ ...validInput, minShifts: 7 })
    expect(result.success).toBe(true)
  })

  it('rejects empty roleIds array', () => {
    const result = employeeSchema.safeParse({ ...validInput, roleIds: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'roleIds')
      expect(issue?.message).toContain('תפקיד')
    }
  })

  it('rejects roleIds with invalid UUID', () => {
    const result = employeeSchema.safeParse({ ...validInput, roleIds: ['not-a-uuid'] })
    expect(result.success).toBe(false)
  })

  it('accepts multiple valid role UUIDs', () => {
    const result = employeeSchema.safeParse({
      ...validInput,
      roleIds: [validUUID, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
    })
    expect(result.success).toBe(true)
  })

  it('observesShabbat and mustAccept are booleans', () => {
    const result = employeeSchema.safeParse({
      ...validInput,
      observesShabbat: true,
      mustAccept: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.observesShabbat).toBe(true)
      expect(result.data.mustAccept).toBe(true)
    }
  })
})
