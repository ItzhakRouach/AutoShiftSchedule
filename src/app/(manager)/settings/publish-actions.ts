'use server'

// WhatsApp delivery uses a self-hosted Evolution API. The connection
// (URL / apikey / instance) is configured app-wide via env vars; per workplace
// we only store the target group JID here.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'

export type PublishActionState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

const publishSchema = z.object({
  publish_dow: z.coerce
    .number()
    .int()
    .min(0, { message: 'יום לא תקין' })
    .max(6, { message: 'יום לא תקין' }),
  publish_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'שעה לא תקינה (HH:MM)' }),
})

export async function updatePublishSettings(
  prevState: PublishActionState,
  formData: FormData,
): Promise<PublishActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  const raw = {
    publish_dow: formData.get('publish_dow'),
    publish_time: formData.get('publish_time'),
  }

  const parsed = publishSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const [key, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = msgs?.[0] ?? 'שגיאה'
    }
    return { fieldErrors }
  }

  const { publish_dow, publish_time } = parsed.data

  const { error: upsertError } = await supabase
    .from('workplace_settings')
    .upsert(
      {
        workplace_id: workplace.id,
        publish_dow,
        publish_time,
      },
      { onConflict: 'workplace_id' },
    )

  if (upsertError) return { error: 'שגיאה בשמירת הגדרות הפרסום' }

  revalidatePath('/settings')
  return { ok: true }
}
