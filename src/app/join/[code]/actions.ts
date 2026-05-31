'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type JoinState = {
  error?: string
  fieldErrors?: Record<string, string>
}

const EMPLOYEE_COLORS = [
  '#3D6BF5', '#13A98E', '#E0902A', '#EB6A4E',
  '#5B61D6', '#B05AB5', '#2E9E6B', '#D94F6A',
]

function pickColor(): string {
  return EMPLOYEE_COLORS[Math.floor(Math.random() * EMPLOYEE_COLORS.length)]
}

function validateFields(name: string, email: string, password: string): Record<string, string> | null {
  const errors: Record<string, string> = {}

  if (!name || name.trim().length < 2) errors.name = 'שם חייב להכיל לפחות 2 תווים'
  if (name && name.trim().length > 120) errors.name = 'שם ארוך מדי (מקסימום 120 תווים)'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'אימייל לא תקין'
  if (!password || password.length < 8) errors.password = 'הסיסמה חייבת לפחות 8 תווים'

  return Object.keys(errors).length > 0 ? errors : null
}

export async function joinWithInvite(
  code: string,
  prevState: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const name = (formData.get('name') as string ?? '').trim()
  const email = (formData.get('email') as string ?? '').trim()
  const password = formData.get('password') as string ?? ''

  const fieldErrors = validateFields(name, email, password)
  if (fieldErrors) return { fieldErrors }

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
  const supabase = await createClient()

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
    const { error: empError } = await admin.from('employees').insert({
      workplace_id: workplaceId,
      user_id: userId,
      name,
      status: 'active',
      color: pickColor(),
    })

    if (empError) {
      return { error: 'שגיאה בהצטרפות למקום העבודה' }
    }
  }

  redirect('/me')
}
