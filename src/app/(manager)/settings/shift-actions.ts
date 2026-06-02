'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'

export type ShiftActionState = { ok?: boolean; error?: string }

const HEX = /^#[0-9a-fA-F]{6}$/

async function ctx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  return { supabase, workplace }
}

function done(): ShiftActionState {
  revalidatePath('/settings')
  revalidatePath('/schedule')
  return { ok: true }
}

const fieldsSchema = z.object({
  name: z.string().trim().min(1, 'שם חסר').max(40, 'שם ארוך מדי'),
  startHour: z.number().int().min(0).max(23),
  hours: z.number().int().min(1).max(23),
  color: z.string().regex(HEX, 'צבע לא תקין'),
})

/** Edit a base shift's display name, start hour, length, and color. */
export async function updateShift(
  id: string,
  fields: { name: string; startHour: number; hours: number; color: string },
): Promise<ShiftActionState> {
  const { supabase, workplace } = await ctx()
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  const parsed = fieldsSchema.safeParse(fields)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('shift_types')
    .update({
      name: parsed.data.name,
      start_hour: parsed.data.startHour,
      hours: parsed.data.hours,
      color: parsed.data.color,
    })
    .eq('id', id)
    .eq('workplace_id', workplace.id)
    .eq('is_fallback', false)
  if (error) return { error: 'שגיאה בעדכון המשמרת' }
  return done()
}

/** Enable/disable a base shift. Disabling drops its staffing requirements; blocks the last active shift. */
export async function setShiftActive(id: string, active: boolean): Promise<ShiftActionState> {
  const { supabase, workplace } = await ctx()
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  if (!active) {
    const { data: activeShifts } = await supabase
      .from('shift_types')
      .select('id')
      .eq('workplace_id', workplace.id)
      .eq('is_fallback', false)
      .eq('is_active', true)
    if ((activeShifts ?? []).length <= 1) return { error: 'חייבת להישאר לפחות משמרת אחת פעילה' }
  }

  const { error } = await supabase
    .from('shift_types')
    .update({ is_active: active })
    .eq('id', id)
    .eq('workplace_id', workplace.id)
    .eq('is_fallback', false)
  if (error) return { error: 'שגיאה בעדכון המשמרת' }

  if (!active) {
    await supabase.from('shift_requirements').delete().eq('workplace_id', workplace.id).eq('shift_type_id', id)
  }
  return done()
}
