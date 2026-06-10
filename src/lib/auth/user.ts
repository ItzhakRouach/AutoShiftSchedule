import { cache } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Per-request cached `auth.getUser()`, keyed on the client instance.
 *
 * `getUser()` is a network round-trip to Supabase Auth; layouts, pages and
 * helpers all need the user, so without caching a single navigation fires it
 * several times. Combined with the memoized `createClient()` (same instance
 * across one request) this collapses them into one call.
 */
export const getAuthUser = cache(
  async (supabase: SupabaseClient): Promise<User | null> => {
    const { data } = await supabase.auth.getUser()
    return data.user
  },
)
