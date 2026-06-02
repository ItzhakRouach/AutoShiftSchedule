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

async function readWorkingDays(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workplaceId: string,
): Promise<number[]> {
  const { data } = await supabase
    .from('workplace_settings')
    .select('working_days')
    .eq('workplace_id', workplaceId)
    .maybeSingle()
  return (data?.working_days as number[] | null) ?? [0, 1, 2, 3, 4, 5, 6]
}

/** Rebuild the full requirement set = (count>0 items) × working days (delete-then-insert). */
async function rebuild(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workplaceId: string,
  items: RequirementsPayloadItem[],
  days: number[],
): Promise<boolean> {
  const { error: delErr } = await supabase
    .from('shift_requirements')
    .delete()
    .eq('workplace_id', workplaceId)
  if (delErr) return false

  const rows = items.filter((it) => it.count > 0).flatMap((it) => buildRows(workplaceId, it, days))
  if (rows.length === 0) return true

  const { error: insErr } = await supabase.from('shift_requirements').insert(rows)
  return !insErr
}

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

  const days = await readWorkingDays(supabase, workplace.id)
  if (!(await rebuild(supabase, workplace.id, parsed.data, days))) {
    return { error: 'שגיאה בשמירת דרישות האיוש' }
  }

  revalidatePath('/settings')
  revalidatePath('/schedule')
  return { ok: true }
}

const workingDaysSchema = z.array(z.number().int().min(0).max(6)).min(1, 'יש לבחור לפחות יום עבודה אחד')

/** Set the workplace's working days and re-apply the count template to only those days. */
export async function setWorkingDays(days: number[]): Promise<RequirementsActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  const parsed = workingDaysSchema.safeParse(days)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const uniqueDays = [...new Set(parsed.data)].sort((a, b) => a - b)

  const { error: setErr } = await supabase
    .from('workplace_settings')
    .upsert({ workplace_id: workplace.id, working_days: uniqueDays }, { onConflict: 'workplace_id' })
  if (setErr) return { error: 'שגיאה בשמירת ימי העבודה' }

  const { data: existing } = await supabase
    .from('shift_requirements')
    .select('shift_type_id, role_id, count')
    .eq('workplace_id', workplace.id)
  const template = new Map<string, RequirementsPayloadItem>()
  for (const r of existing ?? []) {
    const key = `${r.shift_type_id}:${r.role_id}`
    if (!template.has(key)) template.set(key, { shiftTypeId: r.shift_type_id, roleId: r.role_id, count: r.count })
  }

  if (!(await rebuild(supabase, workplace.id, [...template.values()], uniqueDays))) {
    return { error: 'שגיאה בעדכון דרישות האיוש' }
  }

  revalidatePath('/settings')
  revalidatePath('/schedule')
  return { ok: true }
}
