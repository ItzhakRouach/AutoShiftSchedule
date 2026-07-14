import { describe, expect, it } from 'vitest'
import { resetPasswordSchema } from './auth'

describe('resetPasswordSchema', () => {
  it('accepts a valid password with matching confirmation', () => {
    const r = resetPasswordSchema.safeParse({ password: 'longenough1', passwordConfirm: 'longenough1' })
    expect(r.success).toBe(true)
  })

  it('rejects when the confirmation does not match, on the confirm field', () => {
    const r = resetPasswordSchema.safeParse({ password: 'longenough1', passwordConfirm: 'different1' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['passwordConfirm'])
      expect(r.error.issues[0].message).toBe('הסיסמאות אינן תואמות')
    }
  })

  it('rejects a too-short password even when both fields match', () => {
    const r = resetPasswordSchema.safeParse({ password: 'short', passwordConfirm: 'short' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['password'])
    }
  })

  it('rejects an empty confirmation', () => {
    const r = resetPasswordSchema.safeParse({ password: 'longenough1', passwordConfirm: '' })
    expect(r.success).toBe(false)
  })
})
