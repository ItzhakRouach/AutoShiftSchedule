import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorPeriodRow } from './prior-period'

export interface EmpMinRow {
  id: string
  min_shifts_per_week: number | null
}

/** Distinct assigned WORK DAYS per employee in a period (a 12h counts once, per
 *  the assignments unique(period,employee,day) constraint). */
function countDaysByEmployee(rows: { employee_id: string; day_of_week: number }[]): Record<string, number> {
  const seen = new Set<string>()
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const k = `${r.employee_id}:${r.day_of_week}`
    if (seen.has(k)) continue
    seen.add(k)
    counts[r.employee_id] = (counts[r.employee_id] ?? 0) + 1
  }
  return counts
}

function deficitFromCounts(counts: Record<string, number>, employees: EmpMinRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of employees) out[e.id] = Math.max(0, (e.min_shifts_per_week ?? 0) - (counts[e.id] ?? 0))
  return out
}

function extrasFromCounts(counts: Record<string, number>, employees: EmpMinRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of employees) out[e.id] = Math.max(0, (counts[e.id] ?? 0) - (e.min_shifts_per_week ?? 0))
  return out
}

async function fetchPriorCounts(
  supabase: SupabaseClient,
  prior: PriorPeriodRow | null,
): Promise<Record<string, number>> {
  if (!prior) return {}
  const { data } = await supabase
    .from('assignments')
    .select('employee_id, day_of_week')
    .eq('period_id', prior.id)
  return countDaysByEmployee((data ?? []) as { employee_id: string; day_of_week: number }[])
}

/**
 * Cross-week fairness for BOTH deficit and extras from a SINGLE assignments
 * fetch (deficit = max(0, min − worked); extras = max(0, worked − min)). This is
 * what build-input uses on the hot path — the standalone functions below remain
 * for the unit tests that exercise each metric in isolation.
 */
export async function computePriorMetrics(
  supabase: SupabaseClient,
  prior: PriorPeriodRow | null,
  employees: EmpMinRow[],
): Promise<{ deficit: Record<string, number>; extras: Record<string, number> }> {
  if (!prior) return { deficit: {}, extras: {} } // no adjacent week → no carry-over
  const counts = await fetchPriorCounts(supabase, prior)
  return { deficit: deficitFromCounts(counts, employees), extras: extrasFromCounts(counts, employees) }
}

/** Cross-week minimum fairness: priorDeficit = max(0, minShifts − shiftsThen). */
export async function computePriorDeficit(
  supabase: SupabaseClient,
  prior: PriorPeriodRow | null,
  employees: EmpMinRow[],
): Promise<Record<string, number>> {
  if (!prior) return {}
  return deficitFromCounts(await fetchPriorCounts(supabase, prior), employees)
}

/** Cross-week extras fairness: priorExtras = max(0, shiftsThen − minShifts). */
export async function computePriorExtras(
  supabase: SupabaseClient,
  prior: PriorPeriodRow | null,
  employees: EmpMinRow[],
): Promise<Record<string, number>> {
  if (!prior) return {}
  return extrasFromCounts(await fetchPriorCounts(supabase, prior), employees)
}
