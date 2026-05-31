import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isPastDeadline } from './compute'

export interface LockResult {
  locked: number
  errors: string[]
}

/**
 * Finds all collecting schedule_periods whose deadline has passed and flips
 * them to 'locked'. Uses the admin client (service-role) — no user session.
 *
 * @param admin  Service-role Supabase client
 * @param now    Current time (injected for testability)
 */
export async function lockExpiredPeriods(admin: SupabaseClient, now: Date): Promise<LockResult> {
  const errors: string[] = []
  let locked = 0

  // Load all workplace_settings that have a request deadline configured
  const { data: settings, error: settingsErr } = await admin
    .from('workplace_settings')
    .select('workplace_id, request_deadline_dow, request_deadline_time')
    .not('request_deadline_dow', 'is', null)
    .not('request_deadline_time', 'is', null)

  if (settingsErr) {
    errors.push(`settings fetch: ${settingsErr.message}`)
    return { locked, errors }
  }
  if (!settings || settings.length === 0) return { locked, errors }

  for (const setting of settings) {
    const { workplace_id, request_deadline_dow, request_deadline_time } = setting
    if (request_deadline_dow == null || !request_deadline_time) continue

    // Load 'collecting' periods for this workplace
    const { data: periods, error: periodsErr } = await admin
      .from('schedule_periods')
      .select('id, week_start_date')
      .eq('workplace_id', workplace_id)
      .eq('status', 'collecting')

    if (periodsErr) {
      errors.push(`periods fetch for ${workplace_id}: ${periodsErr.message}`)
      continue
    }
    if (!periods || periods.length === 0) continue

    for (const period of periods) {
      const past = isPastDeadline(
        now,
        period.week_start_date,
        request_deadline_dow,
        request_deadline_time,
      )
      if (!past) continue

      const { error: updateErr } = await admin
        .from('schedule_periods')
        .update({ status: 'locked' })
        .eq('id', period.id)

      if (updateErr) {
        errors.push(`lock period ${period.id}: ${updateErr.message}`)
      } else {
        locked++
      }
    }
  }

  return { locked, errors }
}
