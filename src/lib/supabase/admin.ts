// server-only — NEVER import this in client components or pages without 'use server'.
// This client bypasses RLS using the service-role key.
// Use ONLY for operations that cannot go through the anon/auth'd client
// (e.g., invite redemption where the joining user is not yet authenticated).

import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
