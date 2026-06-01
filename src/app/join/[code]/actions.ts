'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickUniqueColor } from '@/lib/employees/colors'

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
  employmentType: z.enum(['full', 'part', 'student'], { error: 'יש לבחור סוג משרה' }),
  observesShabbat: z.boolean(),
})

function getEmploymentDefaults(type: 'full' | 'part' | 'student') {
  if (type === 'full') return { min_shifts_per_week: 5, max_shifts_per_week: null }
  if (type === 'part') return { min_shifts_per_week: 0, max_shifts_per_week: 4 }
  return { min_shifts_per_week: 0, max_shifts_per_week: 3 }
}

export async function joinWithInvite(
  code: string,
  prevState: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const raw = {
    name: (formData.get('name') as string ?? '').trim(),
    email: (formData.get('email') as string ?? '').trim(),
    password: formData.get('password') as string ?? '',
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

  // Defensive: this flow creates a brand-new account. If someone is already
  // authenticated, refuse — they should be routed by their role, not join here.
  const supabaseAuth = await createClient()
  const {
    data: { user: currentUser },
  } = await supabaseAuth.auth.getUser()
  if (currentUser) {
    return { error: 'אתה כבר מחובר. התנתק כדי להצטרף עם חשבון אחר.' }
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

  // Sign up or sign in via the auth'd client
  const supabase = supabaseAuth

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  })

  let userId: string | undefined

  if (signUpError) {
    // If email already exists, try to sign in instead
    const isExisting =
      signUpError.code === 'user_already_exists' ||
      signUpError.message?.includes('already registered') ||
      signUpError.message?.includes('already been registered')

    if (!isExisting) {
      return { error: 'שגיאה בהרשמה, נסה שוב' }
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData.user) {
      return { error: 'האימייל כבר קיים. בדוק את הסיסמה ונסה שוב.' }
    }

    userId = signInData.user.id
  } else {
    if (!signUpData.session) {
      return { error: 'נשלח אימייל אימות. אנא אשרו את האימייל ואז התחברו.' }
    }
    userId = signUpData.user?.id
  }

  if (!userId) return { error: 'שגיאה ביצירת המשתמש' }

  // Upsert employee row via admin (bypass RLS)
  const { data: existing } = await admin
    .from('employees')
    .select('id')
    .eq('workplace_id', workplaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    // Pick a color unique within this workplace
    const { data: existingEmployees } = await admin
      .from('employees')
      .select('color')
      .eq('workplace_id', workplaceId)
    const existingColors = (existingEmployees ?? []).map((e: { color: string }) => e.color).filter(Boolean)
    const color = pickUniqueColor(existingColors)

    const shiftDefaults = getEmploymentDefaults(employmentType)

    const { error: empError } = await admin.from('employees').insert({
      workplace_id: workplaceId,
      user_id: userId,
      name,
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
