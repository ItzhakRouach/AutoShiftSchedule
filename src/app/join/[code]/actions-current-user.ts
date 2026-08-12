'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toLocalIsraeliPhone } from '@/lib/whatsapp/phone'
import { claimOrCreateEmployee } from './claim-employee'
import { baseJoinShape, readBaseJoinFields } from './join-schema'
import { buildFieldErrors } from '@/lib/validation/field-errors'
import type { JoinState } from './actions'

const CurrentUserJoinSchema = z.object(baseJoinShape)

/**
 * Server action for an already-authenticated user with role `none` who wants
 * to join a workplace via an invite code, keeping their existing account.
 * No email/password fields — the user is already logged in.
 */
export async function joinAsCurrentUser(
  code: string,
  pendingEmployeeId: string | undefined,
  prevState: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const raw = readBaseJoinFields(formData)

  const parsed = CurrentUserJoinSchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: buildFieldErrors(parsed.error) }

  const { name, employmentType, observesShabbat, observesHolidays } = parsed.data

  const phone = toLocalIsraeliPhone(parsed.data.phone)
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
    observesHolidays,
    pendingEmployeeId,
  })
  if (claimError) return { error: claimError }

  redirect('/me')
}
