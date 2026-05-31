/**
 * Core publish logic — factored out of the cron route for testability.
 * Loads due workplaces, publishes their schedule periods, uploads PNG,
 * and optionally sends via GreenAPI.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isPublishDue } from './compute'
import { renderSchedulePng } from '@/lib/schedule/render-image'
import { sendScheduleImage } from '@/lib/whatsapp/greenapi'
import type { RawAssignment } from '@/lib/schedule/image-data'

export interface PublishResult {
  published: number
  sent: number
  errors: string[]
}

type STKey = { key: string }
type EmpName = { name: string }

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
    .select('workplace_id, publish_dow, publish_time, greenapi_instance, greenapi_token, greenapi_group, workplaces(name, timezone)')
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

    const wpRow = setting.workplaces as { name?: string; timezone?: string } | null
    const tz = (Array.isArray(wpRow) ? wpRow[0]?.timezone : wpRow?.timezone) ?? 'Asia/Jerusalem'
    const workplaceName = (Array.isArray(wpRow) ? wpRow[0]?.name : wpRow?.name) ?? 'סידור שבועי'

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

    // Build PNG
    const [assignsResult, reqResult] = await Promise.all([
      admin.from('assignments')
        .select('day_of_week, shift_type_id, employees(name), shift_types(key)')
        .eq('period_id', period.id),
      admin.from('shift_requirements')
        .select('day_of_week, count, shift_types(key)')
        .eq('workplace_id', workplace_id),
    ])

    const assignments: RawAssignment[] = (assignsResult.data ?? []).map((a) => ({
      day_of_week: a.day_of_week,
      shift_type_key: (a.shift_types as unknown as STKey | null)?.key ?? '',
      employee_name: (a.employees as unknown as EmpName | null)?.name ?? '',
    }))
    const required: Record<number, Record<string, number>> = {}
    for (const r of reqResult.data ?? []) {
      const sk = (r.shift_types as unknown as STKey | null)?.key
      if (!sk) continue
      const day = r.day_of_week as number
      ;(required[day] ??= {})[sk] = ((required[day]?.[sk]) ?? 0) + (r.count as number)
    }

    const png = await renderSchedulePng({ workplaceName, weekStartISO: period.week_start_date, assignments, required })

    // Upload to public bucket
    const storagePath = `${period.id}.png`
    const { error: uploadErr } = await admin.storage
      .from('schedule-images')
      .upload(storagePath, png, { contentType: 'image/png', upsert: true })

    if (uploadErr) {
      errors.push(`storage upload for ${period.id}: ${uploadErr.message}`)
      continue
    }

    const { data: { publicUrl } } = admin.storage
      .from('schedule-images')
      .getPublicUrl(storagePath)

    // Optional GreenAPI send
    const { greenapi_instance, greenapi_token, greenapi_group } = setting
    if (greenapi_instance && greenapi_token && greenapi_group) {
      const weekLabel = period.week_start_date
      const result = await sendScheduleImage({
        instanceId: greenapi_instance,
        token: greenapi_token,
        group: greenapi_group,
        imageUrl: publicUrl,
        caption: `סידור העבודה לשבוע ${weekLabel}`,
      })
      if (result.ok) {
        sent++
      } else {
        errors.push(`greenapi for ${period.id}: ${result.error ?? 'unknown'}`)
      }
    }
  }

  return { published, sent, errors }
}
