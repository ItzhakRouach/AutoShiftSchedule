/**
 * Core publish logic — factored out of the cron route for testability.
 * Loads due workplaces, publishes their earliest unpublished period, and
 * renders + uploads the schedule image (so the public share link works).
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { autoPublishWindow, isPublishDue } from './compute'
import { buildAndUploadScheduleImage } from './image'
import { notifyWorkplacePublished } from '@/lib/push/send'

/** Cap concurrent per-workplace publishes (image render + upload is the heavy
 *  part) so the cron finishes fast without stampeding the DB/storage. */
const PUBLISH_CONCURRENCY = 4

export interface PublishResult {
  published: number
  errors: string[]
}

type PublishSetting = {
  workplace_id: string
  publish_dow: number | null
  publish_time: string | null
  workplaces: { timezone?: string } | { timezone?: string }[] | null
}

/** Publish ONE due workplace's earliest unpublished recent period. */
async function publishForWorkplace(
  admin: SupabaseClient,
  setting: PublishSetting,
  now: Date,
): Promise<{ published: number; errors: string[] }> {
  const { workplace_id } = setting

  // Publish the earliest not-yet-published period. 'locked' is the normal
  // case (deadline cron locked it); 'collecting' covers workplaces with no
  // request deadline configured, so their schedule still goes out on time.
  // Bounded to autoPublishWindow (Israel wall clock): when the imminent week
  // is already manager-published, the cron must NOT reach into next week's
  // half-built draft — it would go public before its request deadline.
  const { minWeek, maxWeek } = autoPublishWindow(now)
  const { data: periods, error: periodsErr } = await admin
    .from('schedule_periods')
    .select('id, week_start_date')
    .eq('workplace_id', workplace_id)
    .in('status', ['locked', 'collecting'])
    .gte('week_start_date', minWeek)
    .lte('week_start_date', maxWeek)
    .order('week_start_date', { ascending: true })
    .limit(1)

  if (periodsErr) return { published: 0, errors: [`periods fetch for ${workplace_id}: ${periodsErr.message}`] }
  if (!periods?.length) {
    // A period outside the window (stale, or a future week's draft) is
    // deliberately not auto-published now, but silently skipping it makes the
    // cron look broken — leave a trail.
    const { data: stale } = await admin
      .from('schedule_periods')
      .select('week_start_date')
      .eq('workplace_id', workplace_id)
      .in('status', ['locked', 'collecting'])
      .order('week_start_date', { ascending: true })
      .limit(1)
    if (stale?.length) {
      console.warn('[publish cron] skipping stale period', workplace_id, stale[0].week_start_date)
    }
    return { published: 0, errors: [] }
  }

  const period = periods[0]
  const { error: updateErr } = await admin
    .from('schedule_periods')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', period.id)
  if (updateErr) return { published: 0, errors: [`publish period ${period.id}: ${updateErr.message}`] }

  // Render + upload the schedule image (best-effort) so the share link works.
  await buildAndUploadScheduleImage(admin, period.id)
  // Notify employees their schedule is out (best-effort; no-ops without push).
  await notifyWorkplacePublished(admin, workplace_id)
  return { published: 1, errors: [] }
}

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapBounded<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

export async function publishDuePeriods(
  admin: SupabaseClient,
  now: Date,
): Promise<PublishResult> {
  // Load workplaces with publish schedule configured
  const { data: settings, error: settingsErr } = await admin
    .from('workplace_settings')
    .select('workplace_id, publish_dow, publish_time, workplaces(name, timezone)')
    .not('publish_dow', 'is', null)
    .not('publish_time', 'is', null)

  if (settingsErr) return { published: 0, errors: [`settings fetch: ${settingsErr.message}`] }

  const due = ((settings ?? []) as PublishSetting[]).filter((s) => {
    if (s.publish_dow == null || !s.publish_time) return false
    const wpRow = s.workplaces
    const tz = (Array.isArray(wpRow) ? wpRow[0]?.timezone : wpRow?.timezone) ?? 'Asia/Jerusalem'
    return isPublishDue(now, s.publish_dow, s.publish_time, tz)
  })
  if (!due.length) return { published: 0, errors: [] }

  // Independent workplaces publish concurrently (bounded) — a slow image render
  // for one workplace must not push the others past the cron window.
  const results = await mapBounded(due, PUBLISH_CONCURRENCY, async (s) => {
    try {
      return await publishForWorkplace(admin, s, now)
    } catch (e) {
      console.error('[publish cron]', s.workplace_id, e)
      return { published: 0, errors: [`publish for ${s.workplace_id}: ${e instanceof Error ? e.message : String(e)}`] }
    }
  })

  return {
    published: results.reduce((n, r) => n + r.published, 0),
    errors: results.flatMap((r) => r.errors),
  }
}
