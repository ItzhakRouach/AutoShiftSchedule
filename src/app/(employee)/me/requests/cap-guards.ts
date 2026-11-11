import type { createClient } from '@/lib/supabase/server'
import {
  weeklyCapBlocks, weeklyCapMessage, perDayCapBlocks, perDayCapMessage,
  countRequestDays, requestCapBlocks, requestCapMessage, type RequestDayRow,
} from '@/lib/requests/cap-check'

type Supabase = Awaited<ReturnType<typeof createClient>>

interface CapArgs {
  employee: { id: string; workplace_id: string; unlimited_requests: boolean }
  periodId: string
  dayOfWeek: number
  isOff: boolean
}

/**
 * Server-side cap checks for a NON-EMPTY day save (callers skip this for a
 * clear). Returns the Hebrew error to show, or null when the save may proceed.
 * Order: weekly request-day cap → weekly off-day cap → per-day off cap.
 */
export async function requestCapViolation(
  supabase: Supabase,
  { employee, periodId, dayOfWeek, isOff }: CapArgs,
): Promise<string | null> {
  // One settings read serves all three caps.
  const { data: settingsRow } = await supabase
    .from('workplace_settings')
    .select('max_off_days_per_week, max_off_per_day, max_request_days_per_week')
    .eq('workplace_id', employee.workplace_id)
    .maybeSingle()

  // Weekly REQUEST-DAY cap: any day with a request (off or shifts) counts once.
  // The cap governs adding a NEW request day only — a day that already holds a
  // real request is always editable, even when the employee is over the cap
  // (manager added days, cap lowered mid-week, exemption revoked, migration
  // backfill). Exempt employees (unlimited_requests) skip the check. The
  // `requestCap > 0` guard mirrors the helper's contract; it exists to skip the
  // query when no cap is configured. Like the off caps, this is count-then-
  // write, not atomic: two parallel saves could both pass and land one over
  // the cap — accepted for a preventive nudge in small workplaces.
  const requestCap = (settingsRow?.max_request_days_per_week as number | null | undefined) ?? null
  if (!employee.unlimited_requests && requestCap != null && requestCap > 0) {
    const { data: dayRows } = await supabase
      .from('requests')
      .select('day_of_week, is_off, preferred_shift_ids')
      .eq('period_id', periodId)
      .eq('employee_id', employee.id)
    const rows = (dayRows ?? []) as (RequestDayRow & { day_of_week: number })[]
    const activeRow = rows.find((r) => r.day_of_week === dayOfWeek)
    const activeAlreadyCounts = activeRow != null && countRequestDays([activeRow]) === 1
    if (!activeAlreadyCounts) {
      const used = countRequestDays(rows.filter((r) => r.day_of_week !== dayOfWeek))
      if (requestCapBlocks(requestCap, employee.unlimited_requests, used)) {
        return requestCapMessage(requestCap)
      }
    }
  }

  // Enforce the workplace cap on "יום חופש / לא זמין" requests. Only when the
  // employee is FLIPPING a day TO off (isOff=true). Counts existing off-days
  // for OTHER days in the same period; the day being saved is excluded since
  // the upsert will replace it.
  if (isOff) {
    const cap = (settingsRow?.max_off_days_per_week as number | null) ?? null
    // When cap is null (no limit configured), skip the count query entirely —
    // there's nothing to compare against, and it saves a round-trip.
    if (cap != null && cap > 0) {
      const { data: otherOffs } = await supabase
        .from('requests')
        .select('day_of_week')
        .eq('period_id', periodId)
        .eq('employee_id', employee.id)
        .eq('is_off', true)
        .neq('day_of_week', dayOfWeek)
      const usedExcludingThisDay = (otherOffs ?? []).length
      if (weeklyCapBlocks(cap, usedExcludingThisDay)) {
        return weeklyCapMessage(cap)
      }
    }
    // Per-DAY cap: how many OTHER workers are already off this day (RLS-safe
    // RPC). `> 0` guard is defense-in-depth above the DB CHECK (max_off_per_day
    // can no longer be stored as 0). This is a count-then-insert check, not an
    // atomic constraint — under concurrent saves two employees could both pass
    // the check and both land, slightly overfilling the cap. Accepted: these
    // are small workplaces, the cap is a preventive nudge rather than a hard
    // guarantee, and the scheduling engine's coverage-rescue logic absorbs any
    // resulting shortfall. Upgrade path if it ever matters: an atomic RPC with
    // an advisory lock.
    const perDayCap = settingsRow?.max_off_per_day as number | null | undefined
    if (perDayCap != null && perDayCap > 0) {
      const { data: dayOffCount } = await supabase.rpc('off_count_for_day', {
        p_period: periodId,
        p_day: dayOfWeek,
        p_exclude: employee.id,
      })
      if (perDayCapBlocks(perDayCap, (dayOffCount as number | null) ?? 0)) {
        return perDayCapMessage((dayOffCount as number | null) ?? 0, perDayCap)
      }
    }
  }
  return null
}
