import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { claimOrCreateEmployee, type ClaimParams } from './claim-employee'

/**
 * In-memory fake of the tiny Supabase surface claim-employee uses
 * (select/eq/is/order/limit/maybeSingle, update, insert) over an
 * `employees` table, including the partial-unique index on user_id.
 *
 * `linkedCheckMisses` simulates the double-submit read-skew: the first N
 * user_id-filtered reads return null even though a linked row exists, the
 * way a concurrent transaction's write is invisible to a racing read.
 */
interface Row {
  id: string
  workplace_id: string
  user_id: string | null
  name: string
  phone: string | null
  status: string
  employment_type?: string
  color?: string
  created_at: string
  [key: string]: unknown
}

function fakeAdmin(rows: Row[], opts: { linkedCheckMisses?: number } = {}) {
  const table = rows
  let linkedMisses = opts.linkedCheckMisses ?? 0
  function matches(row: Row, filters: Array<[string, unknown]>, nulls: string[]) {
    return filters.every(([k, v]) => row[k] === v) && nulls.every((k) => row[k] === null)
  }
  function builder() {
    const filters: Array<[string, unknown]> = []
    const nulls: string[] = []
    let updatePatch: Record<string, unknown> | null = null
    const chain = {
      select: () => chain,
      update: (patch: Record<string, unknown>) => {
        updatePatch = patch
        return chain
      },
      insert: (row: Record<string, unknown>) => {
        if (row.user_id && table.some((r) => r.user_id === row.user_id)) {
          return Promise.resolve({
            data: null,
            error: { code: '23505', message: 'duplicate key value violates "employees_user_unique"' },
          })
        }
        table.push({ id: `new-${table.length}`, created_at: '2026-02-01', ...row } as Row)
        return Promise.resolve({ data: null, error: null })
      },
      eq: (k: string, v: unknown) => {
        filters.push([k, v])
        return chain
      },
      is: (k: string, v: unknown) => {
        if (v === null) nulls.push(k)
        return chain
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => {
        const isLinkedCheck = filters.some(([k]) => k === 'user_id') && !updatePatch
        if (isLinkedCheck && linkedMisses > 0) {
          linkedMisses--
          return Promise.resolve({ data: null, error: null })
        }
        const found = table.filter((r) => matches(r, filters, nulls))
        if (updatePatch) {
          const target = found[0]
          if (!target) return Promise.resolve({ data: null, error: null })
          Object.assign(target, updatePatch)
          return Promise.resolve({ data: { id: target.id }, error: null })
        }
        return Promise.resolve({ data: found[0] ?? null, error: null })
      },
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
        resolve({ data: table.filter((r) => matches(r, filters, nulls)), error: null }),
    }
    return chain
  }
  return { from: () => builder() } as unknown as SupabaseClient
}

const baseParams: ClaimParams = {
  workplaceId: 'wp-1',
  userId: 'user-9',
  name: 'שם שהוקלד',
  phone: '972521111111',
  employmentType: 'full',
  observesShabbat: false,
}

function pendingRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'emp-1',
    workplace_id: 'wp-1',
    user_id: null,
    name: 'שם מהמנהל',
    phone: '972529999999',
    status: 'pending',
    employment_type: 'part',
    created_at: '2026-01-01',
    ...overrides,
  }
}

describe('claimOrCreateEmployee', () => {
  it('is idempotent: user already linked in this workplace → no-op success', async () => {
    const rows = [pendingRow({ user_id: 'user-9', status: 'active' })]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), baseParams)
    expect(err).toBeNull()
    expect(rows).toHaveLength(1)
  })

  it('claims by pendingEmployeeId even when the typed phone differs, updating phone and preserving manager config', async () => {
    const rows = [pendingRow()]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), {
      ...baseParams,
      pendingEmployeeId: 'emp-1',
    })
    expect(err).toBeNull()
    expect(rows).toHaveLength(1) // no duplicate row
    expect(rows[0].user_id).toBe('user-9')
    expect(rows[0].status).toBe('active')
    expect(rows[0].phone).toBe('972521111111') // employee's typed phone wins
    expect(rows[0].employment_type).toBe('part') // manager config preserved
  })

  it('ignores a pendingEmployeeId from another workplace and falls back to phone matching', async () => {
    const rows = [
      pendingRow({ id: 'foreign', workplace_id: 'wp-OTHER' }),
      pendingRow({ id: 'emp-2', phone: '972521111111' }),
    ]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), {
      ...baseParams,
      pendingEmployeeId: 'foreign',
    })
    expect(err).toBeNull()
    expect(rows.find((r) => r.id === 'foreign')!.user_id).toBeNull()
    expect(rows.find((r) => r.id === 'emp-2')!.user_id).toBe('user-9')
  })

  it('claims by phone when no pendingEmployeeId is given', async () => {
    const rows = [pendingRow({ phone: '972521111111' })]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), baseParams)
    expect(err).toBeNull()
    expect(rows[0].user_id).toBe('user-9')
    expect(rows[0].name).toBe('שם שהוקלד')
  })

  it('creates a fresh row when nothing matches', async () => {
    const rows: Row[] = []
    const err = await claimOrCreateEmployee(fakeAdmin(rows), baseParams)
    expect(err).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe('user-9')
    expect(rows[0].status).toBe('active')
  })

  it('double submit in the same workplace: 23505 on insert resolves to success, no duplicate row', async () => {
    // Second concurrent submit: the linked-check read misses the first
    // submit's just-committed claim, no pending row is left, insert hits
    // employees_user_unique — must be treated as "already joined".
    const rows = [pendingRow({ user_id: 'user-9', status: 'active', phone: '972521111111' })]
    const err = await claimOrCreateEmployee(fakeAdmin(rows, { linkedCheckMisses: 1 }), baseParams)
    expect(err).toBeNull()
    expect(rows).toHaveLength(1)
  })

  it('23505 caused by membership in ANOTHER workplace still surfaces an error', async () => {
    const rows = [pendingRow({ id: 'other', workplace_id: 'wp-OTHER', user_id: 'user-9', status: 'active' })]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), baseParams)
    expect(err).not.toBeNull()
    expect(rows).toHaveLength(1) // nothing inserted
  })

  // ── Guarded name-match fallback ────────────────────────────────────────────
  // When the manager re-created the employee (pending, with a role) but the
  // person registers with a DIFFERENT phone and no ?e=, claim the single
  // name-matching pending row instead of inserting a duplicate role-less row.

  it('claims by name when exactly one unclaimed pending row matches (no id/phone match)', async () => {
    const rows = [
      pendingRow({ id: 'emp-role', name: 'צחי רואש', phone: '972520000000', employment_type: 'part' }),
    ]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), {
      ...baseParams,
      name: 'צחי רואש',
      phone: '972521111111', // differs from the pending row's phone
    })
    expect(err).toBeNull()
    expect(rows).toHaveLength(1) // no duplicate row
    expect(rows[0].user_id).toBe('user-9')
    expect(rows[0].status).toBe('active')
    expect(rows[0].phone).toBe('972521111111') // employee's typed phone wins
    expect(rows[0].employment_type).toBe('part') // manager config (role) preserved
  })

  it('name match is trimmed and whitespace-collapsed and case-insensitive', async () => {
    const rows = [pendingRow({ id: 'emp-role', name: '  צחי   רואש  ', phone: '972520000000' })]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), {
      ...baseParams,
      name: 'צחי רואש',
      phone: '972521111111',
    })
    expect(err).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe('user-9')
  })

  it('does NOT claim by name when two pending rows share the name (ambiguous) → fresh row', async () => {
    const rows = [
      pendingRow({ id: 'a', name: 'צחי רואש', phone: '972520000001' }),
      pendingRow({ id: 'b', name: 'צחי רואש', phone: '972520000002' }),
    ]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), {
      ...baseParams,
      name: 'צחי רואש',
      phone: '972521111111',
    })
    expect(err).toBeNull()
    expect(rows).toHaveLength(3) // fresh row created, neither pending claimed
    expect(rows.find((r) => r.id === 'a')!.user_id).toBeNull()
    expect(rows.find((r) => r.id === 'b')!.user_id).toBeNull()
  })

  it('does NOT claim a name-matching pending row from another workplace', async () => {
    const rows = [
      pendingRow({ id: 'foreign', workplace_id: 'wp-OTHER', name: 'צחי רואש', phone: '972520000000' }),
    ]
    const err = await claimOrCreateEmployee(fakeAdmin(rows), {
      ...baseParams,
      name: 'צחי רואש',
      phone: '972521111111',
    })
    expect(err).toBeNull()
    expect(rows.find((r) => r.id === 'foreign')!.user_id).toBeNull()
    expect(rows).toHaveLength(2) // fresh row created in wp-1
  })
})
