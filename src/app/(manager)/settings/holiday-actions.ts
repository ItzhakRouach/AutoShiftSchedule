'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { israeliChagDates } from '@/lib/holidays/israel'

export type HolidayActionState = { ok?: boolean; error?: string }

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'תאריך לא תקין (YYYY-MM-DD)' })

const nameSchema = z
  .string()
  .min(1, { message: 'שם החג לא יכול להיות ריק' })
  .max(80, { message: 'שם ארוך מדי' })

/** Upsert all Israeli melacha-forbidden chagim for `year` into the holidays table. */
export async function loadIsraeliHolidays(
  year: number,
): Promise<HolidayActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  const chagim = israeliChagDates(year)
  if (chagim.length === 0) return { error: 'לא נמצאו חגים לשנה זו' }

  const rows = chagim.map((c) => ({
    workplace_id: workplace.id,
    date: c.date,
    name: c.name,
  }))

  const { error } = await supabase
    .from('holidays')
    .upsert(rows, { onConflict: 'workplace_id,date', ignoreDuplicates: true })

  if (error) return { error: 'שגיאה בטעינת החגים' }

  revalidatePath('/settings')
  return { ok: true }
}

/** Add a single custom holiday. */
export async function addHoliday(
  prevState: HolidayActionState,
  formData: FormData,
): Promise<HolidayActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  const dateResult = dateSchema.safeParse(formData.get('date'))
  const nameResult = nameSchema.safeParse(formData.get('name'))

  if (!dateResult.success) return { error: dateResult.error.issues[0]?.message ?? 'תאריך לא תקין' }
  if (!nameResult.success) return { error: nameResult.error.issues[0]?.message ?? 'שם לא תקין' }

  const { error } = await supabase.from('holidays').upsert(
    { workplace_id: workplace.id, date: dateResult.data, name: nameResult.data },
    { onConflict: 'workplace_id,date' },
  )

  if (error) return { error: 'שגיאה בהוספת החג' }

  revalidatePath('/settings')
  return { ok: true }
}

/** Remove a holiday by id. */
export async function removeHoliday(id: string): Promise<HolidayActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return { error: 'שגיאה במחיקת החג' }
  if (!data || data.length === 0) return { error: 'החג לא נמצא' }

  revalidatePath('/settings')
  return { ok: true }
}
