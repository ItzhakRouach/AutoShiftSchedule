'use server'

import { createClient } from '@/lib/supabase/server'

export interface SubscriptionJSON {
  endpoint: string
  p256dh: string
  auth: string
}

/** Persist (or refresh) the caller's push subscription. RLS scopes it to them. */
export async function saveSubscription(sub: SubscriptionJSON): Promise<{ ok: boolean; error?: string }> {
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) return { ok: false, error: 'נתונים לא תקינים' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'אין הרשאה' }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, { onConflict: 'endpoint' })
  if (error) return { ok: false, error: 'שגיאה בשמירת ההתראות' }
  return { ok: true }
}

/** Remove the caller's subscription for a given endpoint (on disable). */
export async function removeSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  return { ok: true }
}
