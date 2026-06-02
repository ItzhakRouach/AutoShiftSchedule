/**
 * Reusable publish-send logic — shared by the publish cron and the manual
 * "publish" button. For a given (already-published) period it:
 *   1. Renders the schedule PNG, uploads it to the public `schedule-images`
 *      bucket, and sends it to the workplace WhatsApp group (if configured).
 *   2. Sends each worker a personal text listing their own shifts (if they
 *      have a phone and Evolution is configured).
 * Never throws — failures are collected in the result.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderSchedulePng } from '@/lib/schedule/render-image'
import { SHIFT_NAMES, type RawAssignment } from '@/lib/schedule/image-data'
import { isEvolutionConfigured, sendText, sendImage } from '@/lib/whatsapp/evolution'
import { normalizeIsraeliPhone } from '@/lib/whatsapp/phone'
import { buildPersonalMessage, type PersonalShift } from './personal-message'

export interface SendPublishResult {
  groupSent: boolean
  workersSent: number
  failed: number
  errors: string[]
}

type Named = { name: string } | null
type STRow = { key: string; name: string } | null
type EmpRow = { name: string; phone: string | null } | null

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** Render the schedule PNG, upload it, and return its public URL (or null). */
async function buildAndUploadImage(
  admin: SupabaseClient,
  periodId: string,
  workplaceId: string,
  workplaceName: string,
  weekStartISO: string,
  errors: string[],
): Promise<string | null> {
  const [assignsResult, reqResult] = await Promise.all([
    admin.from('assignments')
      .select('day_of_week, shift_type_id, employees(name), shift_types(key)')
      .eq('period_id', periodId),
    admin.from('shift_requirements')
      .select('day_of_week, count, shift_types(key)')
      .eq('workplace_id', workplaceId),
  ])

  const assignments: RawAssignment[] = (assignsResult.data ?? []).map((a) => ({
    day_of_week: a.day_of_week as number,
    shift_type_key: one(a.shift_types as { key: string } | { key: string }[] | null)?.key ?? '',
    employee_name: one(a.employees as Named | Named[])?.name ?? '',
  }))

  const required: Record<number, Record<string, number>> = {}
  for (const r of reqResult.data ?? []) {
    const sk = one(r.shift_types as { key: string } | { key: string }[] | null)?.key
    if (!sk) continue
    const day = r.day_of_week as number
    ;(required[day] ??= {})[sk] = (required[day]?.[sk] ?? 0) + (r.count as number)
  }

  try {
    const png = await renderSchedulePng({ workplaceName, weekStartISO, assignments, required })
    const storagePath = `${periodId}.png`
    const { error: uploadErr } = await admin.storage
      .from('schedule-images')
      .upload(storagePath, png, { contentType: 'image/png', upsert: true })
    if (uploadErr) {
      errors.push(`storage upload for ${periodId}: ${uploadErr.message}`)
      return null
    }
    return admin.storage.from('schedule-images').getPublicUrl(storagePath).data.publicUrl
  } catch (err) {
    errors.push(`render image for ${periodId}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/** Send each worker their personal shift list. */
async function sendPersonalMessages(
  admin: SupabaseClient,
  periodId: string,
  weekLabel: string,
  res: SendPublishResult,
): Promise<void> {
  const { data: rows, error } = await admin
    .from('assignments')
    .select('day_of_week, employee_id, employees(name, phone), shift_types(key, name), roles(name)')
    .eq('period_id', periodId)

  if (error) {
    res.errors.push(`assignments for personal messages: ${error.message}`)
    return
  }

  // Group shifts by employee.
  const byEmployee = new Map<string, { name: string; phone: string | null; shifts: PersonalShift[] }>()
  for (const r of rows ?? []) {
    const emp = one(r.employees as EmpRow | EmpRow[])
    if (!emp) continue
    const st = one(r.shift_types as STRow | STRow[])
    const role = one(r.roles as Named | Named[])
    const key = r.employee_id as string
    const entry = byEmployee.get(key) ?? { name: emp.name, phone: emp.phone, shifts: [] }
    entry.shifts.push({
      day: r.day_of_week as number,
      shiftKey: st?.key ?? '',
      shiftLabel: st?.name ?? SHIFT_NAMES[st?.key ?? ''] ?? st?.key ?? '',
      roleName: role?.name ?? '',
    })
    byEmployee.set(key, entry)
  }

  for (const { name, phone, shifts } of byEmployee.values()) {
    const to = normalizeIsraeliPhone(phone)
    if (!to) continue
    const text = buildPersonalMessage(name, weekLabel, shifts)
    const result = await sendText({ to, text })
    if (result.ok) res.workersSent++
    else {
      res.failed++
      res.errors.push(`personal to ${name}: ${result.error ?? 'unknown'}`)
    }
  }
}

/**
 * Send the published schedule for `periodId` to the WhatsApp group and to each
 * worker individually. Best-effort: never throws.
 */
export async function sendPublish(
  admin: SupabaseClient,
  periodId: string,
): Promise<SendPublishResult> {
  const res: SendPublishResult = { groupSent: false, workersSent: 0, failed: 0, errors: [] }

  const { data: period } = await admin
    .from('schedule_periods')
    .select('id, week_start_date, workplace_id')
    .eq('id', periodId)
    .maybeSingle()
  if (!period) {
    res.errors.push(`period ${periodId} not found`)
    return res
  }

  const { data: setting } = await admin
    .from('workplace_settings')
    .select('whatsapp_group_jid, workplaces(name)')
    .eq('workplace_id', period.workplace_id)
    .maybeSingle()

  const workplaceName = one(setting?.workplaces as Named | Named[])?.name ?? 'סידור שבועי'
  const weekLabel = period.week_start_date as string

  const publicUrl = await buildAndUploadImage(
    admin, period.id, period.workplace_id, workplaceName, period.week_start_date, res.errors,
  )

  if (!isEvolutionConfigured()) return res

  const groupJid = setting?.whatsapp_group_jid as string | null
  if (publicUrl && groupJid) {
    const result = await sendImage({
      to: groupJid,
      imageUrl: publicUrl,
      caption: `סידור העבודה לשבוע ${weekLabel}`,
    })
    if (result.ok) res.groupSent = true
    else {
      res.failed++
      res.errors.push(`group send: ${result.error ?? 'unknown'}`)
    }
  }

  await sendPersonalMessages(admin, period.id, weekLabel, res)
  return res
}
