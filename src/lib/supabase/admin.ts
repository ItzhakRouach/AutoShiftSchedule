// server-only — NEVER import this in client components or pages without 'use server'.
// This client bypasses RLS using the service-role key.
// Use ONLY for operations that cannot go through the anon/auth'd client
// (e.g., invite redemption where the joining user is not yet authenticated).

import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Fail fast with a clear message rather than passing undefined into createClient
  // (which would otherwise crash later, mid-request, with an opaque error).
  if (!url || !key) {
    throw new Error('Missing Supabase admin config: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
