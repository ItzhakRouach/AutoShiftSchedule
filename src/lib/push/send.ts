import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export interface PushPayload {
  title: string
  body: string
  /** Route to open on notification click (default '/'). */
  url?: string
}

let configured = false

/** Configure web-push from env once; returns false when VAPID keys are absent
 *  (dev without keys / misconfigured prod) so callers can safely no-op. */
function ensureConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:noreply@example.com', publicKey, privateKey)
    configured = true
  }
  return true
}

/**
 * Send a push notification to every subscription owned by the given users.
 * Best-effort: prunes subscriptions the push service reports as gone (404/410),
 * swallows other per-endpoint errors, and no-ops when keys/subscriptions are
 * missing. MUST be called with the service-role (admin) client.
 */
export async function sendPushToUsers(
  admin: SupabaseClient,
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number }> {
  if (!ensureConfigured() || userIds.length === 0) return { sent: 0 }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (!subs || subs.length === 0) return { sent: 0 }

  const body = JSON.stringify(payload)
  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
        body,
      )
      sent++
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
  }
  return { sent }
}

/** Notify every account-linked employee of a workplace that the schedule was
 *  published. Best-effort; shared by the publish cron and the manual publish. */
export async function notifyWorkplacePublished(admin: SupabaseClient, workplaceId: string): Promise<void> {
  const { data: emps } = await admin
    .from('employees')
    .select('user_id')
    .eq('workplace_id', workplaceId)
    .not('user_id', 'is', null)
  const userIds = (emps ?? []).map((e) => e.user_id as string).filter(Boolean)
  if (userIds.length === 0) return
  await sendPushToUsers(admin, userIds, {
    title: 'הסידור פורסם',
    body: 'הסידור לשבוע הקרוב פורסם — לחצו לצפייה',
    url: '/me/schedule',
  })
}
