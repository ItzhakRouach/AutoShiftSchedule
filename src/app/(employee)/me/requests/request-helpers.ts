import type { createClient } from '@/lib/supabase/server'

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
): Promise<{ status: string } | null> {
  const { data } = await supabase
    .from('schedule_periods')
    .select('status')
    .eq('id', periodId)
    .eq('workplace_id', workplaceId)
    .maybeSingle()
  return data ?? null
}
