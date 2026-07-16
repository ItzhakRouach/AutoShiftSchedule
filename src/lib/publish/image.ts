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
import { getScheduleImageView } from '@/lib/schedule/image-view'

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
    .select('id, week_start_date, workplace_id, status')
    .eq('id', periodId)
    .maybeSingle()
  if (!period) return null

  try {
    // Same loader + renderer as the preview route → identical pixels.
    const { view, workplaceName } = await getScheduleImageView(admin, period)
    const { png } = await renderSchedulePng(view, workplaceName)
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
