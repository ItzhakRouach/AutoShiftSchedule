'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeIsraeliPhone } from '@/lib/whatsapp/phone'
import { claimOrCreateEmployee } from './claim-employee'
import type { JoinState } from './actions'

const CurrentUserJoinSchema = z.object({
  name: z
    .string()
    .min(2, 'שם חייב להכיל לפחות 2 תווים')
    .max(120, 'שם ארוך מדי (מקסימום 120 תווים)'),
  phone: z.string().min(1, 'יש להזין מספר טלפון'),
  employmentType: z.enum(['full', 'part', 'student'], { error: 'יש לבחור סוג משרה' }),
  observesShabbat: z.boolean(),
})

/**
 * Server action for an already-authenticated user with role `none` who wants
 * to join a workplace via an invite code, keeping their existing account.
 * No email/password fields — the user is already logged in.
 */
export async function joinAsCurrentUser(
  code: string,
  prevState: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const raw = {
    name: (formData.get('name') as string ?? '').trim(),
    phone: (formData.get('phone') as string ?? '').trim(),
    employmentType: formData.get('employmentType') as string ?? 'full',
    observesShabbat: formData.get('observesShabbat') === 'true',
  }

  const parsed = CurrentUserJoinSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { fieldErrors }
  }

  const { name, employmentType, observesShabbat } = parsed.data

  const phone = normalizeIsraeliPhone(parsed.data.phone)
  if (!phone) return { fieldErrors: { phone: 'מספר טלפון לא תקין' } }

  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'לא מחובר. אנא התחבר ונסה שוב.' }
  }

  const admin = createAdminClient()

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

  // F-03: check if the user is already an employee ANYWHERE. The unique
  // partial index `employees_user_unique` would reject the insert below with
  // a 23505, but we want a clear Hebrew error instead of a generic failure.
  const { data: existingAnywhere } = await admin
    .from('employees')
    .select('id, workplace_id')
    .eq('user_id', currentUser.id)
    .maybeSingle()

  if (existingAnywhere && existingAnywhere.workplace_id !== workplaceId) {
    return {
      error:
        'חשבון זה משויך כבר למקום עבודה אחר. ניתן להיות עובד במקום אחד בלבד — צרו חשבון נפרד אם ברצונכם להצטרף למקום נוסף.',
    }
  }

  // Claim the manager-created pending row (matched by phone) instead of
  // inserting a duplicate. See claim-employee.ts for the why.
  const claimError = await claimOrCreateEmployee(admin, {
    workplaceId,
    userId: currentUser.id,
    name,
    phone,
    employmentType,
    observesShabbat,
  })
  if (claimError) return { error: claimError }

  redirect('/me')
}
