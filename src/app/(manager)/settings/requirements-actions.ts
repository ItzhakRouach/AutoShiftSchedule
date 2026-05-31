'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { buildRows } from './requirements-utils'
import type { RequirementsPayloadItem } from './requirements-utils'

export type { RequirementsPayloadItem } from './requirements-utils'

export type RequirementsActionState = {
  ok?: boolean
  error?: string
}

const itemSchema = z.object({
  shiftTypeId: z.string().uuid({ message: 'מזהה משמרת לא תקין' }),
  roleId: z.string().uuid({ message: 'מזהה תפקיד לא תקין' }),
  count: z.number().int().min(0, { message: 'ספירה לא תקינה' }).max(6, { message: 'ספירה לא תקינה' }),
})

const payloadSchema = z.array(itemSchema)

export async function updateRequirements(
  payload: RequirementsPayloadItem[],
): Promise<RequirementsActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) return { error: 'נתונים לא תקינים' }

  const rows = parsed.data.flatMap((item) => buildRows(workplace.id, item))

  if (rows.length === 0) {
    revalidatePath('/settings')
    revalidatePath('/schedule')
    return { ok: true }
  }

  const { error: upsertError } = await supabase
    .from('shift_requirements')
    .upsert(rows, {
      onConflict: 'workplace_id,day_of_week,shift_type_id,role_id',
    })

  if (upsertError) return { error: 'שגיאה בשמירת דרישות האיוש' }

  revalidatePath('/settings')
  revalidatePath('/schedule')
  return { ok: true }
}
