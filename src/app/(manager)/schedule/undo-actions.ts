'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { planUndo, type UndoSnapshot } from '@/lib/schedule/undo-core'
import { authedWorkplace, GENERIC_ERROR, type EditResult } from './edit-actions-helpers'

const rowShapeSchema = z.object({
  shiftTypeId: z.string().uuid(),
  roleId: z.string().uuid(),
  source: z.string().min(1).max(40),
})

const daySchema = z.number().int().min(0).max(6)

const undoSnapshotSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('assign'),
    employeeId: z.string().uuid(),
    day: daySchema,
    prev: rowShapeSchema.nullable(),
  }),
  z.object({
    kind: z.literal('unassign'),
    employeeId: z.string().uuid(),
    day: daySchema,
    row: rowShapeSchema,
  }),
  z.object({
    kind: z.literal('temp-add'),
    assignmentId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal('temp-remove'),
    day: daySchema,
    row: rowShapeSchema.extend({ tempName: z.string().trim().min(1).max(40) }),
  }),
])

/**
 * Reverse a single manual edit using the pre-mutation snapshot the original
 * action returned. This is intentionally NOT re-validated against the engine's
 * constraints: it restores a state that existed on this exact period seconds
 * ago (the manager's own prior state, or an empty cell), so re-running
 * validateManualAssignment would be redundant at best and could spuriously
 * block a legitimate undo at worst (e.g. if a soft warning was involved).
 * Single-step only — there is no undo stack; a second undo has nothing to act on.
 */
export async function undoEdit(periodId: string, snapshot: UndoSnapshot): Promise<EditResult> {
  const parsed = undoSnapshotSchema.safeParse(snapshot)
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR }

  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  // Guard: the period must belong to the authed manager's workplace (same
  // pattern as request-actions.ts) — undo must never reach across workplaces.
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id')
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!period) return { ok: false, error: GENERIC_ERROR }

  const plan = planUndo(parsed.data)

  if (plan.op === 'restore-emp-day-row') {
    const { error } = await supabase.from('assignments').upsert(
      {
        period_id: periodId,
        employee_id: plan.employeeId,
        day_of_week: plan.day,
        shift_type_id: plan.shiftTypeId,
        role_id: plan.roleId,
        source: plan.source,
      },
      { onConflict: 'period_id,employee_id,day_of_week' },
    )
    if (error) return { ok: false, error: GENERIC_ERROR }
  } else if (plan.op === 'delete-emp-day') {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('period_id', periodId)
      .eq('employee_id', plan.employeeId)
      .eq('day_of_week', plan.day)
    if (error) return { ok: false, error: GENERIC_ERROR }
  } else if (plan.op === 'delete-by-id') {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', plan.assignmentId)
      .eq('period_id', periodId)
    if (error) return { ok: false, error: GENERIC_ERROR }
  } else {
    const { error } = await supabase.from('assignments').insert({
      period_id: periodId,
      employee_id: null,
      temp_name: plan.tempName,
      day_of_week: plan.day,
      shift_type_id: plan.shiftTypeId,
      role_id: plan.roleId,
      source: plan.source,
    })
    if (error) return { ok: false, error: GENERIC_ERROR }
  }

  revalidatePath('/schedule')
  return { ok: true }
}
