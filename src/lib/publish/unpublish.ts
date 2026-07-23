// Pure helper: flip a published schedule period back to 'locked' and best-effort
// delete its image from Storage. Returns whether the DB transition fired (so the
// caller can decide whether to revalidate caches, etc.). All auth/workplace
// resolution is handled by the caller (the server action in actions.ts).
//
// Storage deletion is a courtesy: a failed remove() never fails the unpublish,
// since the source-of-truth is the DB status. The image path mirrors the upload
// path in `src/lib/publish/image.ts` (storagePathFor): `${workplaceId}/${periodId}.png`.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function unpublishPeriod(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  workplaceId: string,
  periodId: string,
  /** Status to restore. Callers pass the deadline-appropriate value
   *  ('collecting' before the deadline, 'locked' after). Defaults to 'locked'. */
  nextStatus: 'collecting' | 'locked' = 'locked',
): Promise<{ didUnpublish: boolean }> {
  const { data: updated, error } = await supabase
    .from('schedule_periods')
    .update({ status: nextStatus })
    .eq('id', periodId)
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .select('id')

  if (error || !updated || updated.length === 0) {
    return { didUnpublish: false }
  }

  try {
    await admin.storage
      .from('schedule-images')
      .remove([`${workplaceId}/${periodId}.png`])
  } catch {
    // swallow — DB transition succeeded; storage cleanup is best-effort.
  }

  // Reset employees' GuardPay import markers for this week (admin: the rows are
  // self-only under RLS). The schedule may change before a republish, and the
  // marker is what disables the employee's import button — without this reset
  // they could never pull the updated week into GuardPay.
  try {
    await admin.from('guardpay_syncs').delete().eq('period_id', periodId)
  } catch {
    // swallow — worst case the button stays disabled until unlink/relink.
  }

  return { didUnpublish: true }
}
