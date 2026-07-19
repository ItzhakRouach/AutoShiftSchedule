import { describe, it, expect } from 'vitest'
import { loginGate } from './login-gate'

describe('loginGate', () => {
  // Match: the account's role belongs to the screen they used → allowed, routed home.
  it('manager on the manager screen → ok, /dashboard', () => {
    expect(loginGate('manager', 'manager')).toEqual({ ok: true, dest: '/dashboard' })
  })

  it('employee on the employee screen → ok, /me', () => {
    expect(loginGate('employee', 'employee')).toEqual({ ok: true, dest: '/me' })
  })

  it('none on the manager screen → ok, /onboarding (not-yet-onboarded manager)', () => {
    expect(loginGate('manager', 'none')).toEqual({ ok: true, dest: '/onboarding' })
  })

  // Mismatch: blocked, told which screen is correct.
  it('employee on the manager screen → blocked, correctScreen employee', () => {
    expect(loginGate('manager', 'employee')).toEqual({ ok: false, correctScreen: 'employee' })
  })

  it('manager on the employee screen → blocked, correctScreen manager', () => {
    expect(loginGate('employee', 'manager')).toEqual({ ok: false, correctScreen: 'manager' })
  })

  it('none on the employee screen → blocked, correctScreen manager', () => {
    expect(loginGate('employee', 'none')).toEqual({ ok: false, correctScreen: 'manager' })
  })
})
