import { describe, it, expect } from 'vitest'
import { emp } from './fixtures'

describe('emp() priorExtras passthrough', () => {
  it('defaults to undefined when not provided', () => {
    expect(emp('a').priorExtras).toBeUndefined()
  })
  it('passes the provided value through', () => {
    expect(emp('a', { priorExtras: 3 }).priorExtras).toBe(3)
  })
})
