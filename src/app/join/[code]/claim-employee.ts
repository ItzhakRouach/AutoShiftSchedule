import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { pickUniqueColor } from '@/lib/employees/colors'
import { getEmploymentDefaults, type EmploymentType } from './employment-defaults'

export interface ClaimParams {
  workplaceId: string
  userId: string
  name: string
  phone: string // already normalized E.164
  employmentType: EmploymentType
  observesShabbat: boolean
}

/**
 * Links a registering user to a workplace WITHOUT creating duplicates.
 *
 * The manager pre-creates an employee row (status `pending`, `user_id = NULL`)
 * and sends a wa.me invite to that phone. When the invited user registers we
 * must CLAIM that pending row — set its `user_id`/`status` — rather than INSERT
 * a second row (the previous bug: it looked the employee up by `user_id`, which
 * is always NULL on a pending row, so it never matched and always inserted).
 *
 * Match key is the normalized phone, which both `createEmployee` and the join
 * form run through `normalizeIsraeliPhone`. Manager-configured fields
 * (employment_type, shift bounds, roles, must_accept) are preserved on a claim;
 * only the account link + the employee's own personal fields are written.
 *
 * Returns null on success, or a Hebrew error string.
 */
export async function claimOrCreateEmployee(
  admin: SupabaseClient,
  p: ClaimParams,
): Promise<string | null> {
  // 1. Idempotency: already linked to this user in this workplace? Done.
  const { data: linked } = await admin
    .from('employees')
    .select('id')
    .eq('workplace_id', p.workplaceId)
    .eq('user_id', p.userId)
    .maybeSingle()
  if (linked) return null

  // 2. Claim an UNCLAIMED pending row the manager pre-created for this phone.
  const { data: pending } = await admin
    .from('employees')
    .select('id')
    .eq('workplace_id', p.workplaceId)
    .eq('phone', p.phone)
    .is('user_id', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (pending) {
    const { data: claimed, error: claimErr } = await admin
      .from('employees')
      .update({
        user_id: p.userId,
        status: 'active',
        name: p.name,
        observes_shabbat: p.observesShabbat,
        observes_holidays: p.observesShabbat,
      })
      .eq('id', pending.id)
      .is('user_id', null) // race guard: only claim if still unclaimed
      .select('id')
      .maybeSingle()
    if (claimErr) return 'שגיאה בהצטרפות למקום העבודה'
    if (claimed) return null
    // Lost the claim race — fall through and create a fresh row.
  }

  // 3. No pending row to claim (pure self-signup): create one fresh.
  const { data: existingEmployees } = await admin
    .from('employees')
    .select('color')
    .eq('workplace_id', p.workplaceId)
  const existingColors = (existingEmployees ?? [])
    .map((e: { color: string }) => e.color)
    .filter(Boolean)
  const color = pickUniqueColor(existingColors)
  const shiftDefaults = getEmploymentDefaults(p.employmentType)

  const { error: empError } = await admin.from('employees').insert({
    workplace_id: p.workplaceId,
    user_id: p.userId,
    name: p.name,
    phone: p.phone,
    status: 'active',
    color,
    employment_type: p.employmentType,
    min_shifts_per_week: shiftDefaults.min_shifts_per_week,
    max_shifts_per_week: shiftDefaults.max_shifts_per_week,
    observes_shabbat: p.observesShabbat,
    observes_holidays: p.observesShabbat,
  })
  if (empError) return 'שגיאה בהצטרפות למקום העבודה'
  return null
}
