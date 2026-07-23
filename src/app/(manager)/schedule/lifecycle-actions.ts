'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { buildAndUploadScheduleImage } from '@/lib/publish/image'
import { notifyWorkplacePublished } from '@/lib/push/send'
import { unpublishPeriod } from '@/lib/publish/unpublish'
import { statusForDeadline } from '@/lib/publish/period-status'
import { GENERIC_ERROR, MANUAL_SOURCES, type RunResult } from './run-actions-shared'

export async function publishSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const { data: updated, error } = await supabase
    .from('schedule_periods')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .select('id')

  if (error) return { ok: false, error: GENERIC_ERROR }
  if (!updated || updated.length === 0) return { ok: false, error: GENERIC_ERROR }

  // Best-effort: render + upload the schedule image so the WhatsApp share link
  // works, and push a "schedule published" notification to employees. Uses the
  // admin client. Never fails the publish.
  try {
    const admin = createAdminClient()
    await buildAndUploadScheduleImage(admin, periodId)
    await notifyWorkplacePublished(admin, workplace.id)
  } catch {
    // swallow — the schedule is published regardless of image/push
  }

  revalidatePath('/schedule')
  revalidatePath('/dashboard') // KPIs + fairness reflect published schedules
  return { ok: true }
}

/** Returns true if the period has any manual/12h assignments. */
export async function hasManualAssignments(periodId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('assignments')
    .select('id')
    .eq('period_id', periodId)
    .in('source', MANUAL_SOURCES)
    .limit(1)
  return (data ?? []).length > 0
}

/**
 * Wipe ALL assignments for a period so the manager can generate a fresh
 * schedule from scratch (auto + manual + 12h rows). If the period was
 * published, it's unpublished first (clears the shared image + flips status).
 */
export async function clearSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  // Authorize: the period must belong to the manager's workplace.
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id, status')
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!period) return { ok: false, error: GENERIC_ERROR }

  // If published, unpublish first (status flip + image cleanup).
  if (period.status === 'published') {
    try {
      const admin = createAdminClient()
      await unpublishPeriod(supabase, admin, workplace.id, periodId)
    } catch {
      return { ok: false, error: GENERIC_ERROR }
    }
  }

  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('period_id', periodId)
  if (error) return { ok: false, error: GENERIC_ERROR }

  // Reopen the worker request window if the deadline hasn't passed (a locked
  // period left over from a prior publish/unpublish shouldn't stay closed when
  // the manager wipes the schedule before the deadline).
  const nextStatus = await statusForDeadline(supabase, workplace.id, periodId)
  await supabase
    .from('schedule_periods')
    .update({ status: nextStatus })
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .neq('status', 'published')

  revalidatePath('/schedule')
  revalidatePath('/me/schedule')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function unpublishSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  try {
    const admin = createAdminClient()
    // Restore requests if still before the deadline; otherwise lock.
    const nextStatus = await statusForDeadline(supabase, workplace.id, periodId)
    await unpublishPeriod(supabase, admin, workplace.id, periodId, nextStatus)
  } catch {
    // unpublishPeriod itself never throws; this guards createAdminClient.
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidatePath('/schedule')
  revalidatePath('/me/schedule')
  revalidatePath('/dashboard')
  return { ok: true }
}
