import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShiftId } from '@/lib/domain/constants'
import { buildEngineInput } from './build-input'
import { getWorkplaceShiftTypes } from './shift-types-cache'
import {
  validateAssignmentCore,
  type CommittedSlot,
  type Verdict,
} from './validate-edit-core'

export type { Verdict } from './validate-edit-core'

const SHIFT_KEYS = new Set(['morning', 'noon', 'night'])

interface ValidateArgs {
  supabase: SupabaseClient
  periodId: string
  employeeId: string
  dayIndex: number
  shiftKey: ShiftId
  roleId: string
}

/**
 * Loads the period via the existing adapter, resolves the employee's CURRENT
 * assignments (excluding the day we're editing — a same-day shift is replaced),
 * and re-validates a proposed manual assignment with the pure engine core.
 * Returns a Hebrew verdict. Null-safe: unknown period → generic hard reason.
 */
export async function validateManualAssignment(
  args: ValidateArgs,
): Promise<Verdict> {
  const { supabase, periodId, employeeId, dayIndex, shiftKey, roleId } = args

  const built = await buildEngineInput(supabase, periodId)
  if (!built) return { ok: false, severity: 'hard', reason: 'לא נמצאו נתוני שיבוץ' }

  const emp = built.input.employees.find((e) => e.id === employeeId)
  const meta = built.input.days[dayIndex]
  if (!emp || !meta) return { ok: false, severity: 'hard', reason: 'נתונים חסרים לבדיקה' }

  // The engine keys roles by NAME; map the UUID → name (reuse the adapter map).
  const roleIdToName: Record<string, string> = {}
  for (const [name, id] of Object.entries(built.nameToRoleId)) roleIdToName[id] = name
  const roleName = roleIdToName[roleId]
  if (!roleName) return { ok: false, severity: 'hard', reason: 'תפקיד לא תקין' }

  // shift_type_id → ShiftId key (base + 12h variants). Shared per-request via
  // React.cache so multiple validate calls within one server action dedupe.
  const { keyById: idToKey } = await getWorkplaceShiftTypes(supabase, built.period.workplace_id)

  // The employee's other committed assignments this week (exclude today's slot —
  // upsert replaces the same-day row, so it must not count against rest/one-per-day).
  const { data: rows } = await supabase
    .from('assignments')
    .select('day_of_week, shift_type_id, role_id')
    .eq('period_id', periodId)
    .eq('employee_id', employeeId)

  const others: CommittedSlot[] = []
  for (const r of rows ?? []) {
    if (r.day_of_week === dayIndex) continue
    const key = idToKey[r.shift_type_id as string]
    if (!key) continue
    others.push({ day: r.day_of_week as number, shiftKey: key, roleId: r.role_id as string })
  }

  const request = built.input.requests[employeeId]?.[dayIndex] ?? { off: false, preferred: [] }

  return validateAssignmentCore({
    emp,
    meta,
    shiftKey,
    roleId: roleName,
    request,
    others,
    settings: built.input.settings,
    isTwelveHour: !SHIFT_KEYS.has(shiftKey),
    priorTail: built.input.priorWeekTail?.[employeeId],
    nextHead: built.input.nextWeekHead?.[employeeId],
  })
}
