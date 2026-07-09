'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validateManualAssignment, type Verdict } from '@/lib/schedule/validate-edit'
import { resolveShiftKey } from '@/lib/schedule/shift-types-cache'
import type { SwapSide, UndoSnapshot } from '@/lib/schedule/undo-core'
import { authedWorkplace, GENERIC_ERROR, type EditResult } from './edit-actions-helpers'

export interface SwapCell {
  employeeId: string
  day: number
  shiftTypeId: string
  roleId: string
}

/** Load a participant's existing base row; reject 12h/temp rows (UI excludes
 *  them, this is the server-side guarantee). */
async function loadRow(
  supabase: Awaited<ReturnType<typeof authedWorkplace>>['supabase'],
  periodId: string,
  employeeId: string,
  day: number,
) {
  const { data } = await supabase
    .from('assignments')
    .select('shift_type_id, role_id, source, twelve_fills')
    .eq('period_id', periodId)
    .eq('employee_id', employeeId)
    .eq('day_of_week', day)
    .maybeSingle()
  if (!data) return null
  if (data.source === 'fallback_12h' || data.twelve_fills != null) return null
  return { shiftTypeId: data.shift_type_id as string, roleId: data.role_id as string, source: data.source as string }
}

/** Does the employee hold ANY assignment row on this day (12h included)? */
async function loadRowAnySource(
  supabase: Awaited<ReturnType<typeof authedWorkplace>>['supabase'],
  periodId: string,
  employeeId: string,
  day: number,
): Promise<boolean> {
  const { data } = await supabase
    .from('assignments')
    .select('id')
    .eq('period_id', periodId)
    .eq('employee_id', employeeId)
    .eq('day_of_week', day)
    .maybeSingle()
  return !!data
}

/**
 * Drag-to-swap: exchange A and B between two cells (same-day or cross-day), or
 * MOVE A to an empty target cell (`b` null) vacating A's source. Both
 * directions re-validate with the vacated day excluded; writes go through the
 * atomic swap_assignments RPC so a half-swap can never persist. Returns a
 * combined soft warning (if any) + a 'swap' undo snapshot.
 */
export async function swapSlots(
  periodId: string,
  a: SwapCell,
  target: { day: number; shiftTypeId: string; roleId: string },
  b: SwapCell | null,
): Promise<EditResult> {
  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const [aKey, bKey] = await Promise.all([
    resolveShiftKey(supabase, workplace.id, target.shiftTypeId),
    b ? resolveShiftKey(supabase, workplace.id, a.shiftTypeId) : Promise.resolve(null),
  ])
  if (!aKey || (b && !bKey)) return { ok: false, error: GENERIC_ERROR }

  // Current rows (undo source-of-truth); missing/12h rows abort.
  const [aRow, bRow] = await Promise.all([
    loadRow(supabase, periodId, a.employeeId, a.day),
    b ? loadRow(supabase, periodId, b.employeeId, b.day) : Promise.resolve(null),
  ])
  if (!aRow || (b && !bRow)) return { ok: false, error: 'השיבוץ השתנה — רעננו את העמוד' }

  // One-shift/day across the exchange: a cross-day swap may not land a worker
  // on a day they already work in ANOTHER cell (the RPC insert would collide).
  const BUSY = 'העובד כבר משובץ במשמרת אחרת ביום זה'
  if (target.day !== a.day && (await loadRowAnySource(supabase, periodId, a.employeeId, target.day))) {
    return { ok: false, error: BUSY }
  }
  if (b && a.day !== b.day && (await loadRowAnySource(supabase, periodId, b.employeeId, a.day))) {
    return { ok: false, error: BUSY }
  }

  // Validate both directions as-if the vacated rows are already gone.
  const okVerdict: Verdict = { ok: true }
  const [aVerdict, bVerdict] = await Promise.all([
    validateManualAssignment({
      supabase, periodId, employeeId: a.employeeId,
      dayIndex: target.day, shiftKey: aKey, roleId: target.roleId,
      excludeDays: [a.day],
    }),
    b
      ? validateManualAssignment({
          supabase, periodId, employeeId: b.employeeId,
          dayIndex: a.day, shiftKey: bKey!, roleId: a.roleId,
          excludeDays: [b.day],
        })
      : Promise.resolve(okVerdict),
  ])
  if (!aVerdict.ok) return { ok: false, error: aVerdict.reason }
  if (!bVerdict.ok) return { ok: false, error: bVerdict.reason }
  const warnings = [aVerdict, bVerdict]
    .filter((v) => v.severity === 'soft' && v.reason)
    .map((v) => v.reason as string)

  const sideA: SwapSide = {
    employeeId: a.employeeId, fromDay: a.day, fromRow: aRow,
    toDay: target.day,
    toRow: { shiftTypeId: target.shiftTypeId, roleId: target.roleId, source: 'manual' },
  }
  const sideB: SwapSide | null = b && bRow
    ? {
        employeeId: b.employeeId, fromDay: b.day, fromRow: bRow,
        toDay: a.day,
        toRow: { shiftTypeId: a.shiftTypeId, roleId: a.roleId, source: 'manual' },
      }
    : null

  const { error } = await supabase.rpc('swap_assignments', {
    p_period: periodId,
    a_employee: sideA.employeeId,
    a_from_day: sideA.fromDay,
    a_to_day: sideA.toDay,
    a_to_shift: sideA.toRow.shiftTypeId,
    a_to_role: sideA.toRow.roleId,
    a_source: 'manual',
    b_employee: sideB?.employeeId ?? null,
    b_from_day: sideB?.fromDay ?? null,
    b_to_day: sideB?.toDay ?? null,
    b_to_shift: sideB?.toRow.shiftTypeId ?? null,
    b_to_role: sideB?.toRow.roleId ?? null,
    b_source: 'manual',
  })
  if (error) return { ok: false, error: GENERIC_ERROR }

  const undo: UndoSnapshot = { kind: 'swap', a: sideA, b: sideB }
  revalidatePath('/schedule')
  return { ok: true, warning: warnings.length ? warnings.join('\n') : undefined, undo }
}
