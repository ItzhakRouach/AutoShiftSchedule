import { describe, expect, it } from 'vitest'
import { isExistingUserSignUp } from './signup-result'

// When email confirmations are ON, Supabase "succeeds" on a duplicate signUp
// but returns an obfuscated fake user with an EMPTY identities array and no
// session. A genuinely new unconfirmed user has one identity and no session.
describe('isExistingUserSignUp', () => {
  it('detects the obfuscated existing-user response (empty identities, no session)', () => {
    expect(isExistingUserSignUp({ user: { identities: [] }, session: null })).toBe(true)
  })

  it('is false for a new unconfirmed user (has an identity, no session yet)', () => {
    expect(isExistingUserSignUp({ user: { identities: [{ id: 'x' }] }, session: null })).toBe(false)
  })

  it('is false when a session was created (confirmations off — brand-new user)', () => {
    expect(
      isExistingUserSignUp({ user: { identities: [] }, session: { access_token: 't' } }),
    ).toBe(false)
  })

  it('is false when there is no user at all', () => {
    expect(isExistingUserSignUp({ user: null, session: null })).toBe(false)
  })

  it('is false when identities is undefined (defensive)', () => {
    expect(isExistingUserSignUp({ user: {}, session: null })).toBe(false)
  })
})
