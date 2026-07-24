import type { createClient } from '@/lib/supabase/server'
import { isRequestLocked } from '@/lib/deadline/compute'

export type ActionResult = { ok: true } | { error: string }

/** Resolves the employee row (id + workplace) for the authenticated user. */
export async function resolveEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from('employees')
    .select('id, workplace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return data
}

/** True if the period exists AND belongs to the employee's workplace. Guards
 *  against acting on another workplace's period via a crafted periodId. */
export async function periodInWorkplace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periodId: string,
  workplaceId: string,
): Promise<{ status: string; week_start_date: string } | null> {
  const { data } = await supabase
    .from('schedule_periods')
    .select('status, week_start_date')
    .eq('id', periodId)
    .eq('workplace_id', workplaceId)
    .maybeSingle()
  return (data as { status: string; week_start_date: string } | null) ?? null
}

/**
 * Real-time request-window lock for a period — the server write-gate twin of the
 * page's `isReadOnly`. Delegates fully to `isRequestLocked` (deadline governs when
 * configured; otherwise status governs), so a week PUBLISHED before its deadline
 * stays editable exactly as the UI shows it. Must NOT short-circuit on status —
 * doing so re-locks published-pre-deadline weeks and diverges from the UI,
 * silently rejecting saves the form invites.
 */
export async function requestWindowLocked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  period: { status: string; week_start_date: string },
  workplaceId: string,
): Promise<boolean> {
  const [{ data: settings }, { data: wp }] = await Promise.all([
    supabase
      .from('workplace_settings')
      .select('request_deadline_dow, request_deadline_time')
      .eq('workplace_id', workplaceId)
      .maybeSingle(),
    supabase.from('workplaces').select('timezone').eq('id', workplaceId).maybeSingle(),
  ])
  return isRequestLocked(
    period.status,
    period.week_start_date,
    settings?.request_deadline_dow as number | null | undefined,
    settings?.request_deadline_time as string | null | undefined,
    (wp?.timezone as string | null | undefined) ?? 'Asia/Jerusalem',
    new Date(),
  )
}
