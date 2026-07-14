interface SignUpResultLike {
  user: { identities?: unknown[] } | null
  session: unknown | null
}

/**
 * With email confirmations enabled, Supabase obfuscates duplicate signups:
 * no error, no session, and a fake user whose `identities` array is EMPTY.
 * A genuinely new (unconfirmed) user always carries at least one identity.
 */
export function isExistingUserSignUp(data: SignUpResultLike): boolean {
  return !data.session && !!data.user && data.user.identities?.length === 0
}
