'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { authedWorkplace, GENERIC_ERROR, type EditResult } from './edit-actions-helpers'

/** Free-text caption shown inside a marked cell. '' is legal — a blank white
 *  cell with no caption. Mirrors the `label` check in the slot_marks table. */
const labelSchema = z.string().trim().max(30)
const LABEL_INVALID = 'הטקסט ארוך מדי (עד 30 תווים).'
const NO_WORKPLACE = 'לא נמצא מקום עבודה.'
const BAD_SLOT = 'משבצת לא תקינה.'

/** The cell's coordinates. Validated so a malformed id is rejected cleanly
 *  instead of surfacing as a Postgres cast error. Tenancy itself is enforced by
 *  RLS (`owns_period`), not by the workplace lookup below. */
const slotSchema = z.object({
  periodId: z.uuid(),
  dayIndex: z.number().int().min(0).max(6),
  shiftTypeId: z.uuid(),
  roleId: z.uuid(),
})

/**
 * Mark a (day, shift, role) cell as intentionally empty, with an optional
 * caption (e.g. "יום כיפור"). Upserts on the unique slot key, so re-marking an
 * already-marked cell just rewrites its caption. RLS scopes the write to the
 * manager who owns the period.
 */
export async function setSlotMark(
  periodId: string,
  dayIndex: number,
  shiftTypeId: string,
  roleId: string,
  label: string,
): Promise<EditResult> {
  const parsed = labelSchema.safeParse(label)
  if (!parsed.success) return { ok: false, error: LABEL_INVALID }
  const slot = slotSchema.safeParse({ periodId, dayIndex, shiftTypeId, roleId })
  if (!slot.success) return { ok: false, error: BAD_SLOT }

  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: NO_WORKPLACE }

  const { error } = await supabase
    .from('slot_marks')
    .upsert(
      {
        period_id: periodId,
        day_of_week: dayIndex,
        shift_type_id: shiftTypeId,
        role_id: roleId,
        label: parsed.data,
      },
      { onConflict: 'period_id,day_of_week,shift_type_id,role_id' },
    )
  if (error) return { ok: false, error: GENERIC_ERROR }

  revalidatePath('/schedule')
  return { ok: true }
}

/** Remove the mark from a cell — it goes back to being a real "לא מאויש" gap. */
export async function clearSlotMark(
  periodId: string,
  dayIndex: number,
  shiftTypeId: string,
  roleId: string,
): Promise<EditResult> {
  const slot = slotSchema.safeParse({ periodId, dayIndex, shiftTypeId, roleId })
  if (!slot.success) return { ok: false, error: BAD_SLOT }

  const { redirectLogin, supabase, workplace } = await authedWorkplace()
  if (redirectLogin) redirect('/login')
  if (!workplace) return { ok: false, error: NO_WORKPLACE }

  // A delete that matches nothing returns no error, so the deleted rows are
  // selected back: without this an RLS-denied or stale target would report
  // "הסימון הוסר ✓" while the cell stayed marked (temp-actions.ts precedent).
  const { data, error } = await supabase
    .from('slot_marks')
    .delete()
    .eq('period_id', periodId)
    .eq('day_of_week', dayIndex)
    .eq('shift_type_id', shiftTypeId)
    .eq('role_id', roleId)
    .select('id')
  if (error || !data || data.length === 0) return { ok: false, error: GENERIC_ERROR }

  revalidatePath('/schedule')
  return { ok: true }
}
