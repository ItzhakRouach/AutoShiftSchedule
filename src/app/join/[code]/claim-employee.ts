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
  /** Pending-row id carried by the wa.me link (?e=). Claimed by id first, so
   *  the right row is linked even if the employee typed a different phone. */
  pendingEmployeeId?: string
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

  // 2. Claim by the id carried in the invite link (?e=) — scoped to this
  //    workplace and only while unclaimed, so the param can't touch anything
  //    else. Beats phone matching: the row is linked even when the employee
  //    typed a different phone than the manager saved.
  if (p.pendingEmployeeId) {
    const claimed = await claimPendingRow(admin, p, p.pendingEmployeeId)
    if (claimed === 'error') return 'שגיאה בהצטרפות למקום העבודה'
    if (claimed) return null
  }

  // 3. Claim an UNCLAIMED pending row the manager pre-created for this phone.
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
    const claimed = await claimPendingRow(admin, p, pending.id)
    if (claimed === 'error') return 'שגיאה בהצטרפות למקום העבודה'
    if (claimed) return null
    // Lost the claim race — fall through and create a fresh row.
  }

  // 3.5. Guarded name fallback. A manager may have re-created the employee as a
  //      pending row (with a role) but the person registered with a DIFFERENT
  //      phone and no ?e= — so steps 2-3 missed. If EXACTLY ONE unclaimed
  //      pending row in this workplace matches the typed name (normalized), claim
  //      it, preserving the manager-set role. Ambiguous (0 or >1) → fall through
  //      to a fresh row; never guess between rows.
  const wantName = normalizeName(p.name)
  if (wantName) {
    const { data: unclaimed } = await admin
      .from('employees')
      .select('id, name')
      .eq('workplace_id', p.workplaceId)
      .is('user_id', null)
    const nameMatches = (unclaimed ?? []).filter(
      (r: { name: string }) => normalizeName(r.name) === wantName,
    )
    if (nameMatches.length === 1) {
      const claimed = await claimPendingRow(admin, p, nameMatches[0].id)
      if (claimed === 'error') return 'שגיאה בהצטרפות למקום העבודה'
      if (claimed) return null
      // Lost the claim race — fall through and create a fresh row.
    }
  }

  // 4. No pending row to claim (pure self-signup): create one fresh.
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
  if (empError) {
    // Double submit: the racing request already linked this user. The unique
    // index rejects the insert — if the linked row is in THIS workplace, the
    // join actually succeeded.
    if (empError.code === '23505') {
      const { data: nowLinked } = await admin
        .from('employees')
        .select('id')
        .eq('workplace_id', p.workplaceId)
        .eq('user_id', p.userId)
        .maybeSingle()
      if (nowLinked) return null
    }
    return 'שגיאה בהצטרפות למקום העבודה'
  }
  return null
}

/** Normalize a name for matching: trim, collapse inner whitespace, lowercase.
 *  Empty/whitespace-only names normalize to '' so they never match. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Atomically claim one unclaimed pending row by id within the workplace.
 *  Returns the claimed row id, null when the row was missing/already claimed,
 *  or 'error' on a query failure. */
async function claimPendingRow(
  admin: SupabaseClient,
  p: ClaimParams,
  pendingId: string,
): Promise<string | null | 'error'> {
  const { data: claimed, error } = await admin
    .from('employees')
    .update({
      user_id: p.userId,
      status: 'active',
      name: p.name,
      phone: p.phone,
      observes_shabbat: p.observesShabbat,
      observes_holidays: p.observesShabbat,
    })
    .eq('id', pendingId)
    .eq('workplace_id', p.workplaceId)
    .is('user_id', null) // race guard: only claim if still unclaimed
    .select('id')
    .maybeSingle()
  if (error) return 'error'
  return claimed?.id ?? null
}
