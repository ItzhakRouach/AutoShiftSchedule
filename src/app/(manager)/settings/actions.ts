'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { hhmm } from '@/lib/dates/time'

export type DeadlineActionState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

const deadlineSchema = z.object({
  request_deadline_dow: z.coerce
    .number()
    .int()
    .min(0, { message: 'יום לא תקין' })
    .max(6, { message: 'יום לא תקין' }),
  request_deadline_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'שעה לא תקינה (HH:MM)' }),
  // Empty input → null (no per-day off cap).
  max_off_per_day: z
    .union([z.coerce.number().int().min(0).max(50), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
})

export async function updateRequestDeadline(
  prevState: DeadlineActionState,
  formData: FormData,
): Promise<DeadlineActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  const raw = {
    request_deadline_dow: formData.get('request_deadline_dow'),
    // Normalise to HH:MM (the field may submit HH:MM:SS from a DB-seeded value).
    request_deadline_time: hhmm(formData.get('request_deadline_time') as string | null),
    max_off_per_day: (formData.get('max_off_per_day') as string | null) ?? '',
  }

  const parsed = deadlineSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const [key, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = msgs?.[0] ?? 'שגיאה'
    }
    return { fieldErrors }
  }

  const { request_deadline_dow, request_deadline_time, max_off_per_day } = parsed.data

  const { error: upsertError } = await supabase
    .from('workplace_settings')
    .upsert(
      {
        workplace_id: workplace.id,
        request_deadline_dow,
        request_deadline_time,
        max_off_per_day,
      },
      { onConflict: 'workplace_id' },
    )

  if (upsertError) return { error: 'שגיאה בשמירת ההגדרות' }

  revalidatePath('/settings')
  return { ok: true }
}
