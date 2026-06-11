/**
 * Render the schedule PNG for a period and upload it to the private
 * `schedule-images` bucket, returning a TIME-LIMITED SIGNED URL (or null on
 * failure). Used by the publish cron and the manual "publish" action so the
 * schedule image + WhatsApp share link are always available.
 *
 * Storage path is namespaced by workplace_id so a leaked period UUID cannot
 * be used to guess sibling tenants' assets. The signed URL TTL is 7 days —
 * sufficient for the typical "publish on Thursday, share to the WhatsApp
 * group, manager forwards the link a few days" workflow. Regenerate via
 * `getSignedScheduleImageUrl` on demand for re-shares.
 *
 * Never throws.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderSchedulePng } from '@/lib/schedule/render-image'
import { type RawAssignment } from '@/lib/schedule/image-data'

type Named = { name: string } | null

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** 7 days in seconds — TTL for the published-schedule signed URL. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

/** Build the storage path for a period's image, namespaced by workplace. */
function storagePathFor(workplaceId: string, periodId: string): string {
  return `${workplaceId}/${periodId}.png`
}

/** Generate a fresh signed URL for an already-uploaded schedule image.
 *  Returns null if no object exists yet or signing fails. Cheap (1 round-trip)
 *  so it's safe to call per page render rather than caching the URL. */
export async function getSignedScheduleImageUrl(
  admin: SupabaseClient,
  workplaceId: string,
  periodId: string,
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from('schedule-images')
    .createSignedUrl(storagePathFor(workplaceId, periodId), SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/** Render + upload the schedule PNG; returns a 7-day signed URL or null. */
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
      .select('day_of_week, shift_type_id, temp_name, employees(name), shift_types(key)')
      .eq('period_id', periodId),
    admin.from('shift_requirements')
      .select('day_of_week, count, shift_types(key)')
      .eq('workplace_id', period.workplace_id),
  ])

  const assignments: RawAssignment[] = (assignsResult.data ?? []).map((a) => ({
    day_of_week: a.day_of_week as number,
    shift_type_key: one(a.shift_types as { key: string } | { key: string }[] | null)?.key ?? '',
    employee_name: one(a.employees as Named | Named[])?.name ?? (a.temp_name as string | null) ?? '',
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
    const storagePath = storagePathFor(period.workplace_id as string, periodId)
    const { error: uploadErr } = await admin.storage
      .from('schedule-images')
      .upload(storagePath, png, { contentType: 'image/png', upsert: true })
    if (uploadErr) return null
    return getSignedScheduleImageUrl(admin, period.workplace_id as string, periodId)
  } catch {
    return null
  }
}
