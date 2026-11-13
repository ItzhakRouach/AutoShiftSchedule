import type { SupabaseClient } from '@supabase/supabase-js'

/** The verified identity the app needs — a subset of the Supabase `User`. */
export interface AuthUser {
  id: string
  email?: string
}

// Memoized per client instance (createClient() hands out one per request), so
// layouts, pages, helpers and Server Actions share a single resolution.
const resolved = new WeakMap<SupabaseClient, Promise<AuthUser | null>>()

/**
 * The signed-in user for this request, from the locally verified JWT.
 *
 * `getClaims()` checks the token signature against the project's asymmetric
 * signing keys (JWKS cached in memory), so it costs no Auth round-trip. The
 * proxy has already validated + refreshed the session with `getUser()` on this
 * same request, so a revoked session never gets this far.
 */
export function getAuthUser(supabase: SupabaseClient): Promise<AuthUser | null> {
  let hit = resolved.get(supabase)
  if (!hit) {
    hit = readClaims(supabase)
    resolved.set(supabase, hit)
  }
  return hit
}

async function readClaims(supabase: SupabaseClient): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined }
}
