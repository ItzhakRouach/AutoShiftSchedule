'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { normalizeIsraeliPhone } from '@/lib/whatsapp/phone'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
// Reusable invite window: long enough for the whole team to join from one link.
const EXPIRE_DAYS = 90

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes)
    .map((b) => CODE_CHARS[b % CODE_CHARS.length])
    .join('')
}

// Invite codes are workplace-level and intentionally REUSABLE: a single code
// may be redeemed by many employees until `expires_at`. There is no per-use
// consumption — managers can also generate a fresh code at any time.
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
      return { error: 'שגיאה ביצירת הזמנה' }
    }
  }

  return { error: 'לא הצלחנו ליצור קוד ייחודי, נסה שוב' }
}

/** Build the public join URL for a code, using the request host (or
 *  NEXT_PUBLIC_BASE_URL when set). Server-only — called from server actions. */
async function resolveJoinUrl(code: string): Promise<string> {
  const headerList = await headers()
  const host = headerList.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`
  return `${base}/join/${code}`
}

/** Get-or-create an active invite for a workplace. Reuses the most-recent
 *  non-expired code when one exists, else creates a fresh one via createInvite's
 *  internal path. Server-only. */
async function ensureActiveInviteCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workplaceId: string,
  userId: string,
): Promise<{ code: string } | { error: string }> {
  const existing = await getLatestInvite(workplaceId)
  if (existing) return { code: existing.code }
  // No active code — create one. Reuses the unique-collision retry logic.
  const expiresAt = new Date(Date.now() + EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data, error } = await supabase
      .from('invites')
      .insert({ workplace_id: workplaceId, code, created_by: userId, expires_at: expiresAt })
      .select('code').single()
    if (!error && data) return { code: data.code }
    const isUnique = error?.code === '23505' || error?.message?.includes('unique')
    if (!isUnique) return { error: 'שגיאה ביצירת הזמנה' }
  }
  return { error: 'לא הצלחנו ליצור קוד ייחודי' }
}

export type InviteShareLink =
  | { ok: true; waUrl: string; joinUrl: string }
  | { ok: false; error: string }

/**
 * Build a pre-filled `wa.me` link the manager can tap to open WhatsApp with
 * an invite message already addressed to the employee's phone. No background
 * "send" — the user explicitly confirms the share via WhatsApp's own UI, so
 * there are zero per-message costs and no third-party API in the loop.
 *
 * Resolves (or creates) the workplace's active invite code as a side-effect.
 */
export async function getInviteShareLinkForPhone(
  rawPhone: string,
  employeeName?: string,
  employeeId?: string,
): Promise<InviteShareLink> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'אין הרשאה' }
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה' }

  const phone = normalizeIsraeliPhone(rawPhone)
  if (!phone) return { ok: false, error: 'מספר טלפון לא תקין' }

  const invite = await ensureActiveInviteCode(supabase, workplace.id, user.id)
  if ('error' in invite) return { ok: false, error: invite.error }
  // Carry the pending employee id so the join form prefills name + phone.
  const baseJoinUrl = await resolveJoinUrl(invite.code)
  const joinUrl = employeeId ? `${baseJoinUrl}?e=${employeeId}` : baseJoinUrl

  const greeting = employeeName ? `שלום ${employeeName}!` : 'שלום!'
  const text = `${greeting} הוזמנת לאפליקציית סידור עבודה — לחץ כאן להצטרפות: ${joinUrl}`
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
  return { ok: true, waUrl, joinUrl }
}

/**
 * Same as getInviteShareLinkForPhone but starts from an employee id. Powers
 * the "שלח הזמנה" button on pending employee cards.
 */
export async function getInviteShareLinkForEmployee(employeeId: string): Promise<InviteShareLink> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'אין הרשאה' }
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה' }

  const { data: emp } = await supabase
    .from('employees')
    .select('name, phone')
    .eq('id', employeeId)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!emp) return { ok: false, error: 'העובד לא נמצא' }
  if (!emp.phone) return { ok: false, error: 'לעובד אין מספר טלפון' }
  return getInviteShareLinkForPhone(emp.phone as string, emp.name as string | undefined, employeeId)
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
