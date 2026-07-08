import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deadlineDateTime } from '@/lib/deadline/compute'
import { sendPushToUsers } from './send'

/** Remind within this window BEFORE the deadline (the daily cron fires it once). */
const WINDOW_MS = 24 * 60 * 60 * 1000

export interface RemindResult {
  reminded: number
  errors: string[]
}

/**
 * Push a reminder to employees who haven't submitted requests for a collecting
 * period whose deadline is within the next 24h. Admin (service-role) client.
 * Best-effort and safe to run daily — no-ops without VAPID keys/subscriptions.
 */
export async function remindMissingRequests(admin: SupabaseClient, now: Date): Promise<RemindResult> {
  const errors: string[] = []
  let reminded = 0

  const { data: settings, error } = await admin
    .from('workplace_settings')
    .select('workplace_id, request_deadline_dow, request_deadline_time, workplaces(timezone)')
    .not('request_deadline_dow', 'is', null)
    .not('request_deadline_time', 'is', null)
  if (error) { errors.push(`settings: ${error.message}`); return { reminded, errors } }

  for (const s of settings ?? []) {
    const dow = s.request_deadline_dow as number | null
    const time = s.request_deadline_time as string | null
    if (dow == null || !time) continue
    const wpRow = s.workplaces as { timezone?: string | null } | { timezone?: string | null }[] | null
    const tz = (Array.isArray(wpRow) ? wpRow[0]?.timezone : wpRow?.timezone) ?? 'Asia/Jerusalem'

    const { data: periods } = await admin
      .from('schedule_periods')
      .select('id, week_start_date')
      .eq('workplace_id', s.workplace_id)
      .eq('status', 'collecting')

    for (const p of periods ?? []) {
      const dt = deadlineDateTime(p.week_start_date, dow, time, tz).getTime() - now.getTime()
      if (dt <= 0 || dt > WINDOW_MS) continue // only the ~24h before the deadline

      const { data: emps } = await admin
        .from('employees')
        .select('id, user_id')
        .eq('workplace_id', s.workplace_id)
        .not('user_id', 'is', null)
      if (!emps || emps.length === 0) continue

      const { data: subs } = await admin
        .from('request_submissions')
        .select('employee_id')
        .eq('period_id', p.id)
      const submitted = new Set((subs ?? []).map((r) => r.employee_id as string))
      const userIds = emps.filter((e) => !submitted.has(e.id as string)).map((e) => e.user_id as string).filter(Boolean)
      if (userIds.length === 0) continue

      const res = await sendPushToUsers(admin, userIds, {
        title: 'תזכורת: הגשת בקשות',
        body: 'מועד הגשת הבקשות מתקרב — אל תשכחו להגיש את הבקשות לשבוע הקרוב',
        url: '/me/requests',
      })
      reminded += res.sent
    }
  }
  return { reminded, errors }
}
