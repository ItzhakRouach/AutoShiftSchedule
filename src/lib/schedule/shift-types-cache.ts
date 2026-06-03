import 'server-only'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShiftId } from '@/lib/domain/constants'

/** Bidirectional shift_types lookup for a workplace, scoped per request via React.cache. */
export interface WorkplaceShiftTypes {
  /** shift key (e.g. 'morning', 'm12_day') → shift_type_id */
  idByKey: Record<string, string>
  /** shift_type_id → ShiftId key */
  keyById: Record<string, ShiftId>
}

/**
 * Fetch + memoize the workplace's shift_types table for the lifetime of ONE
 * server request. Two action handlers that touch the same workplace (e.g.
 * apply + validate during an edit) share the same Supabase round-trip.
 *
 * React.cache() deduplicates by reference-equal argument identity; the
 * SupabaseClient is request-scoped via createClient(), and workplaceId is a
 * string, so the cache key is effectively (request, workplaceId) — exactly the
 * scope we want. Subsequent requests get a fresh fetch.
 */
export const getWorkplaceShiftTypes = cache(
  async (
    supabase: SupabaseClient,
    workplaceId: string,
  ): Promise<WorkplaceShiftTypes> => {
    const { data } = await supabase
      .from('shift_types')
      .select('id, key')
      .eq('workplace_id', workplaceId)
    const idByKey: Record<string, string> = {}
    const keyById: Record<string, ShiftId> = {}
    for (const st of data ?? []) {
      idByKey[st.key as string] = st.id as string
      keyById[st.id as string] = st.key as ShiftId
    }
    return { idByKey, keyById }
  },
)

/** Resolve a single shift_type_id → ShiftId key. */
export async function resolveShiftKey(
  supabase: SupabaseClient,
  workplaceId: string,
  shiftTypeId: string,
): Promise<ShiftId | null> {
  const { keyById } = await getWorkplaceShiftTypes(supabase, workplaceId)
  return keyById[shiftTypeId] ?? null
}
