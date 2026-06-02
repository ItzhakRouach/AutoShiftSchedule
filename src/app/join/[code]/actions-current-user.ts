'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickUniqueColor } from '@/lib/employees/colors'
import { normalizeIsraeliPhone } from '@/lib/whatsapp/phone'
import { getEmploymentDefaults } from './employment-defaults'
import type { JoinState } from './actions'

const CurrentUserJoinSchema = z.object({
  name: z
    .string()
    .min(2, 'שם חייב להכיל לפחות 2 תווים')
    .max(120, 'שם ארוך מדי (מקסימום 120 תווים)'),
  phone: z.string().optional(),
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

  // Phone is optional contact info; store normalized when valid, else null.
  const phone = normalizeIsraeliPhone(parsed.data.phone)

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

  const { data: existing } = await admin
    .from('employees')
    .select('id')
    .eq('workplace_id', workplaceId)
    .eq('user_id', currentUser.id)
    .maybeSingle()

  if (!existing) {
    const { data: existingEmployees } = await admin
      .from('employees')
      .select('color')
      .eq('workplace_id', workplaceId)
    const existingColors = (existingEmployees ?? [])
      .map((e: { color: string }) => e.color)
      .filter(Boolean)
    const color = pickUniqueColor(existingColors)
    const shiftDefaults = getEmploymentDefaults(employmentType)

    const { error: empError } = await admin.from('employees').insert({
      workplace_id: workplaceId,
      user_id: currentUser.id,
      name,
      phone,
      status: 'active',
      color,
      employment_type: employmentType,
      min_shifts_per_week: shiftDefaults.min_shifts_per_week,
      max_shifts_per_week: shiftDefaults.max_shifts_per_week,
      observes_shabbat: observesShabbat,
      observes_holidays: observesShabbat,
    })

    if (empError) {
      return { error: 'שגיאה בהצטרפות למקום העבודה' }
    }
  }

  redirect('/me')
}
