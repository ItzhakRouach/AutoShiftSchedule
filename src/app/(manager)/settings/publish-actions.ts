'use server'

// security note: The GreenAPI token is stored as a plain DB column.
// RLS restricts access to the owning manager only.
// For a production system, consider encrypting sensitive fields at rest
// (e.g. via Supabase Vault or an application-level encryption layer).

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
  greenapi_enabled: z.boolean().default(false),
  greenapi_instance: z.string().max(80).optional(),
  greenapi_token: z.string().max(120).optional(),
  greenapi_group: z.string().max(80).optional(),
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
    greenapi_enabled: formData.get('greenapi_enabled') === 'true',
    greenapi_instance: formData.get('greenapi_instance') ?? undefined,
    greenapi_token: formData.get('greenapi_token') ?? undefined,
    greenapi_group: formData.get('greenapi_group') ?? undefined,
  }

  const parsed = publishSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const [key, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = msgs?.[0] ?? 'שגיאה'
    }
    return { fieldErrors }
  }

  const { publish_dow, publish_time, greenapi_enabled, greenapi_instance, greenapi_token, greenapi_group } =
    parsed.data

  const { error: upsertError } = await supabase
    .from('workplace_settings')
    .upsert(
      {
        workplace_id: workplace.id,
        publish_dow,
        publish_time,
        greenapi_instance: greenapi_enabled ? (greenapi_instance ?? null) : null,
        greenapi_token: greenapi_enabled ? (greenapi_token ?? null) : null,
        greenapi_group: greenapi_enabled ? (greenapi_group ?? null) : null,
      },
      { onConflict: 'workplace_id' },
    )

  if (upsertError) return { error: 'שגיאה בשמירת הגדרות הפרסום' }

  revalidatePath('/settings')
  return { ok: true }
}
