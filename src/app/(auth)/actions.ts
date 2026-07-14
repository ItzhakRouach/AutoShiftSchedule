'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/auth/base-url'
import { resolveUserRole } from '@/lib/auth/role'
import { isExistingUserSignUp } from '@/lib/auth/signup-result'
import { signInSchema, signUpSchema } from '@/lib/validation/auth'

export type AuthState = {
  error?: string
  ok?: boolean
  fieldErrors?: Record<string, string>
}

/** Land each role on its own home, skipping the /dashboard bounce. */
async function redirectByRole(supabase: Awaited<ReturnType<typeof createClient>>): Promise<never> {
  const { role } = await resolveUserRole(supabase)
  if (role === 'employee') redirect('/me')
  if (role === 'none') redirect('/onboarding')
  redirect('/dashboard')
}

export async function signIn(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = signInSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0])
      if (!fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return { fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'אימייל או סיסמה שגויים' }
  }

  return redirectByRole(supabase)
}

export async function signUp(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = signUpSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0])
      if (!fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return { fieldErrors }
  }

  const supabase = await createClient()
  const baseUrl = await getBaseUrl()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // With email confirmations on (hosted default) the verification link
      // must land back in the app, not on the dashboard Site URL.
      emailRedirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent('/onboarding')}`,
    },
  })

  if (error) {
    const isDuplicate =
      error.code === 'user_already_exists' ||
      error.message.includes('already registered') ||
      error.message.includes('already been registered')
    return { error: isDuplicate ? 'משתמש עם אימייל זה כבר קיים' : 'שגיאה בהרשמה, נסה שוב' }
  }

  // With confirmations on, Supabase obfuscates duplicate emails as a fake
  // "success" — detect it so existing users aren't told to check their inbox.
  if (isExistingUserSignUp(data)) {
    return { error: 'משתמש עם אימייל זה כבר קיים' }
  }

  if (!data.session) {
    return { error: 'נשלח אימייל אימות. אנא אשרו את האימייל ואז התחברו.' }
  }

  // A brand-new user has no organization yet — send them to onboarding.
  // The (manager) guard would otherwise bounce them here anyway.
  redirect('/onboarding')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Send a password-reset email. Always reports success (never leaks whether an
 * account exists). The link lands on /auth/callback which establishes a session
 * and forwards to /reset-password.
 */
export async function requestPasswordReset(
  prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = (formData.get('email') as string ?? '').trim()
  const parsed = z.string().email().safeParse(email)
  if (!parsed.success) return { fieldErrors: { email: 'אימייל לא תקין' } }

  const baseUrl = await getBaseUrl()
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
  })

  return { ok: true }
}

/** Set a new password for the currently-authenticated (recovery) session. */
export async function updatePassword(
  prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = (formData.get('password') as string) ?? ''
  const parsed = z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים').safeParse(password)
  if (!parsed.success) return { fieldErrors: { password: parsed.error.issues[0].message } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'הקישור פג תוקף או אינו תקין. בקשו קישור חדש לאיפוס.' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) return { error: 'שגיאה בעדכון הסיסמה, נסו שוב' }

  return redirectByRole(supabase)
}
