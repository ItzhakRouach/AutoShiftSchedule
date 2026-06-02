/**
 * Core publish logic — factored out of the cron route for testability.
 * Loads due workplaces, publishes their earliest unpublished period, and
 * delegates image + per-worker WhatsApp sending to `sendPublish`.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isPublishDue } from './compute'
import { sendPublish } from './send'

export interface PublishResult {
  published: number
  sent: number
  errors: string[]
}

export async function publishDuePeriods(
  admin: SupabaseClient,
  now: Date,
): Promise<PublishResult> {
  const errors: string[] = []
  let published = 0
  let sent = 0

  // Load workplaces with publish schedule configured
  const { data: settings, error: settingsErr } = await admin
    .from('workplace_settings')
    .select('workplace_id, publish_dow, publish_time, workplaces(name, timezone)')
    .not('publish_dow', 'is', null)
    .not('publish_time', 'is', null)

  if (settingsErr) {
    errors.push(`settings fetch: ${settingsErr.message}`)
    return { published, sent, errors }
  }
  if (!settings?.length) return { published, sent, errors }

  for (const setting of settings) {
    const { workplace_id, publish_dow, publish_time } = setting
    if (publish_dow == null || !publish_time) continue

    const wpRow = setting.workplaces as { timezone?: string } | { timezone?: string }[] | null
    const tz = (Array.isArray(wpRow) ? wpRow[0]?.timezone : wpRow?.timezone) ?? 'Asia/Jerusalem'

    if (!isPublishDue(now, publish_dow, publish_time, tz)) continue

    // Publish the earliest not-yet-published period. 'locked' is the normal
    // case (deadline cron locked it); 'collecting' covers workplaces with no
    // request deadline configured, so their schedule still goes out on time.
    const { data: periods, error: periodsErr } = await admin
      .from('schedule_periods')
      .select('id, week_start_date')
      .eq('workplace_id', workplace_id)
      .in('status', ['locked', 'collecting'])
      .order('week_start_date', { ascending: true })
      .limit(1)

    if (periodsErr) {
      errors.push(`periods fetch for ${workplace_id}: ${periodsErr.message}`)
      continue
    }
    if (!periods?.length) continue

    const period = periods[0]

    // Mark as published
    const { error: updateErr } = await admin
      .from('schedule_periods')
      .update({ status: 'published' })
      .eq('id', period.id)

    if (updateErr) {
      errors.push(`publish period ${period.id}: ${updateErr.message}`)
      continue
    }
    published++

    // Render image + send to group + per-worker (best-effort).
    const result = await sendPublish(admin, period.id)
    sent += (result.groupSent ? 1 : 0) + result.workersSent
    errors.push(...result.errors)
  }

  return { published, sent, errors }
}
