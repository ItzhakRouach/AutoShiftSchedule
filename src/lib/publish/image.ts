/**
 * Render the schedule PNG for a period and upload it to the public
 * `schedule-images` bucket, returning its public URL (or null on failure).
 * Used by the publish cron and the manual "publish" action so the schedule
 * image + WhatsApp share link are always available. Never throws.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderSchedulePng } from '@/lib/schedule/render-image'
import { type RawAssignment } from '@/lib/schedule/image-data'

type Named = { name: string } | null

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** Render + upload the schedule PNG; returns the public URL or null. */
export async function buildAndUploadScheduleImage(
  admin: SupabaseClient,
  periodId: string,
): Promise<string | null> {
  const { data: period } = await admin
    .from('schedule_periods')
    .select('id, week_start_date, workplace_id')
    .eq('id', periodId)
    .maybeSingle()
  if (!period) return null

  const { data: setting } = await admin
    .from('workplace_settings')
    .select('workplaces(name)')
    .eq('workplace_id', period.workplace_id)
    .maybeSingle()
  const workplaceName = one(setting?.workplaces as Named | Named[])?.name ?? 'סידור שבועי'

  const [assignsResult, reqResult] = await Promise.all([
    admin.from('assignments')
      .select('day_of_week, shift_type_id, employees(name), shift_types(key)')
      .eq('period_id', periodId),
    admin.from('shift_requirements')
      .select('day_of_week, count, shift_types(key)')
      .eq('workplace_id', period.workplace_id),
  ])

  const assignments: RawAssignment[] = (assignsResult.data ?? []).map((a) => ({
    day_of_week: a.day_of_week as number,
    shift_type_key: one(a.shift_types as { key: string } | { key: string }[] | null)?.key ?? '',
    employee_name: one(a.employees as Named | Named[])?.name ?? '',
  }))

  const required: Record<number, Record<string, number>> = {}
  for (const r of reqResult.data ?? []) {
    const sk = one(r.shift_types as { key: string } | { key: string }[] | null)?.key
    if (!sk) continue
    const day = r.day_of_week as number
    ;(required[day] ??= {})[sk] = (required[day]?.[sk] ?? 0) + (r.count as number)
  }

  try {
    const png = await renderSchedulePng({
      workplaceName,
      weekStartISO: period.week_start_date,
      assignments,
      required,
    })
    const storagePath = `${periodId}.png`
    const { error: uploadErr } = await admin.storage
      .from('schedule-images')
      .upload(storagePath, png, { contentType: 'image/png', upsert: true })
    if (uploadErr) return null
    return admin.storage.from('schedule-images').getPublicUrl(storagePath).data.publicUrl
  } catch {
    return null
  }
}
