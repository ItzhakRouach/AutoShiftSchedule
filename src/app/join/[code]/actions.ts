'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBaseUrl } from '@/lib/auth/base-url'
import { isExistingUserSignUp } from '@/lib/auth/signup-result'
import { normalizeIsraeliPhone } from '@/lib/whatsapp/phone'
import { claimOrCreateEmployee } from './claim-employee'

export type JoinState = {
  error?: string
  fieldErrors?: Record<string, string>
}

// NOTE: invite codes are intentionally REUSABLE — a single workplace-level
// code can be redeemed by many employees until it expires. We do NOT consume
// or single-use the code here; only expiry gates redemption.

const JoinSchema = z.object({
  name: z
    .string()
    .min(2, 'שם חייב להכיל לפחות 2 תווים')
    .max(120, 'שם ארוך מדי (מקסימום 120 תווים)'),
  email: z.string().email('אימייל לא תקין'),
  password: z.string().min(8, 'הסיסמה חייבת לפחות 8 תווים'),
  phone: z.string().min(1, 'יש להזין מספר טלפון'),
  employmentType: z.enum(['full', 'part', 'student'], { error: 'יש לבחור סוג משרה' }),
  observesShabbat: z.boolean(),
})

export async function joinWithInvite(
  code: string,
  pendingEmployeeId: string | undefined,
  prevState: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const raw = {
    name: (formData.get('name') as string ?? '').trim(),
    email: (formData.get('email') as string ?? '').trim(),
    password: formData.get('password') as string ?? '',
    phone: (formData.get('phone') as string ?? '').trim(),
    employmentType: formData.get('employmentType') as string ?? 'full',
    observesShabbat: formData.get('observesShabbat') === 'true',
  }

  const parsed = JoinSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { fieldErrors }
  }

  const { name, email, password, employmentType, observesShabbat } = parsed.data

  const phone = normalizeIsraeliPhone(parsed.data.phone)
  if (!phone) return { fieldErrors: { phone: 'מספר טלפון לא תקין' } }

  // Defensive: this flow creates a brand-new account. If someone is already
  // authenticated, refuse — they should be routed by their role, not join
  // here. (Also hit after a partial failure: signup succeeded, claim failed —
  // a refresh renders the authenticated join panel, so say exactly that.)
  const supabaseAuth = await createClient()
  const {
    data: { user: currentUser },
  } = await supabaseAuth.auth.getUser()
  if (currentUser) {
    return {
      error:
        'אתה כבר מחובר לחשבון. רענן/י את הדף כדי להצטרף עם החשבון המחובר, או התנתק/י כדי להצטרף עם חשבון אחר.',
    }
  }

  const admin = createAdminClient()

  // Re-validate invite
  const now = new Date().toISOString()
  const { data: invite } = await admin
    .from('invites')
    .select('id, workplace_id')
    .eq('code', code.toUpperCase())
    .gt('expires_at', now)
    .maybeSingle()

  if (!invite) {
    return { error: 'הזמנה לא תקפה או שפגה תוקפה' }
  }

  const workplaceId = invite.workplace_id
  const supabase = supabaseAuth

  // With email confirmations on, the verification link must come back to THIS
  // invite (keeping ?e= so the pending row is still claimed after verifying).
  const baseUrl = await getBaseUrl()
  const joinPath = `/join/${code}${pendingEmployeeId ? `?e=${pendingEmployeeId}` : ''}`
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(joinPath)}`,
    },
  })

  let userId: string | undefined

  if (signUpError) {
    const isExisting =
      signUpError.code === 'user_already_exists' ||
      signUpError.message?.includes('already registered') ||
      signUpError.message?.includes('already been registered')

    if (!isExisting) {
      return { error: 'שגיאה בהרשמה, נסה שוב' }
    }

    // F-11: do NOT auto-sign-in with the form-supplied password — knowledge
    // of someone else's email + password would otherwise let an attacker
    // complete the workplace join under the victim's account. Force them
    // through /login first; once authenticated they can return to the invite
    // link and the joinAsCurrentUser flow takes over.
    return {
      error:
        'אימייל זה כבר רשום במערכת. התחבר/י תחילה דרך מסך ההתחברות וחזור/י לקישור ההזמנה כדי להצטרף למקום העבודה.',
    }
  } else {
    if (isExistingUserSignUp(signUpData)) {
      // Confirmations-on obfuscation of a duplicate email — same guidance as
      // the explicit user_already_exists branch above.
      return {
        error:
          'אימייל זה כבר רשום במערכת. התחבר/י תחילה דרך מסך ההתחברות וחזור/י לקישור ההזמנה כדי להצטרף למקום העבודה.',
      }
    }
    if (!signUpData.session) {
      return { error: 'נשלח אימייל אימות. אנא אשרו את האימייל, הקישור יחזיר אתכם לכאן להשלמת ההצטרפות.' }
    }
    userId = signUpData.user?.id
  }

  if (!userId) return { error: 'שגיאה ביצירת המשתמש' }

  // Claim the manager-created pending row (matched by phone) instead of
  // inserting a duplicate. See claim-employee.ts for the why.
  const claimError = await claimOrCreateEmployee(admin, {
    workplaceId,
    userId,
    name,
    phone,
    employmentType,
    observesShabbat,
    pendingEmployeeId,
  })
  if (claimError) return { error: claimError }

  redirect('/me')
}
