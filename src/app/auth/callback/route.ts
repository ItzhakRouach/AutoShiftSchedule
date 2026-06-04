/**
 * Auth callback for the password-reset (and any PKCE) flow.
 * Supabase's recovery email link lands here; we establish the session and
 * forward to `next` (defaults to /reset-password). Handles both the PKCE
 * `?code=` form and the `?token_hash=&type=` form for robustness.
 */
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // F-05: reject anything that isn't an internal-relative path. Specifically
  // also reject `//evil.com/x` (protocol-relative URL) — browsers resolve
  // `${origin}//evil.com/x` to `https://evil.com/x` and we'd open-redirect.
  let next = searchParams.get('next') ?? '/reset-password'
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    next = '/reset-password'
  }

  const supabase = await createClient()
  let ok = false

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  }

  if (ok) return NextResponse.redirect(`${origin}${next}`)
  return NextResponse.redirect(`${origin}/forgot-password?error=1`)
}
