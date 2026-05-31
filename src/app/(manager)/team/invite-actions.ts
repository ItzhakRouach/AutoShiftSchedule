'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const EXPIRE_DAYS = 14

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes)
    .map((b) => CODE_CHARS[b % CODE_CHARS.length])
    .join('')
}

export type InviteActionResult = { code: string } | { error: string }

export async function createInvite(): Promise<InviteActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  const expiresAt = new Date(Date.now() + EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Retry up to 5 times on unique-code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data, error } = await supabase
      .from('invites')
      .insert({
        workplace_id: workplace.id,
        code,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select('code')
      .single()

    if (!error && data) {
      revalidatePath('/team')
      return { code: data.code }
    }

    // 23505 = unique_violation in Postgres
    const isUniqueViolation =
      error?.code === '23505' || error?.message?.includes('unique')
    if (!isUniqueViolation) {
      return { error: 'שגיאה ביצירת הזמנה: ' + (error?.message ?? 'שגיאה לא ידועה') }
    }
  }

  return { error: 'לא הצלחנו ליצור קוד ייחודי, נסה שוב' }
}

export async function getLatestInvite(workplaceId: string): Promise<{ code: string; expiresAt: string } | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('invites')
    .select('code, expires_at')
    .eq('workplace_id', workplaceId)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { code: data.code, expiresAt: data.expires_at }
}
