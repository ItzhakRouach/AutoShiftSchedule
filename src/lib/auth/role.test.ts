import { describe, it, expect, vi } from 'vitest'
import { getUserRole, resolveUserRole } from './role'
import type { SupabaseClient } from '@supabase/supabase-js'

type Rows = { id: string }[]

function makeSupabase(userId: string | null, orgRows: Rows, employeeRows: Rows) {
  const fromMock = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    // .limit() resolves to the array result (thenable).
    chain.limit = vi.fn(async () => {
      if (table === 'organizations') return { data: orgRows }
      if (table === 'employees') return { data: employeeRows }
      return { data: [] }
    })
    return chain
  })

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
      })),
    },
    from: fromMock,
  } as unknown as SupabaseClient
}

describe('getUserRole', () => {
  it('returns none when no user', async () => {
    expect(await getUserRole(makeSupabase(null, [], []))).toBe('none')
  })

  it('returns manager when user owns an organization', async () => {
    expect(await getUserRole(makeSupabase('u1', [{ id: 'o1' }], []))).toBe('manager')
  })

  it('returns employee when user has an employees row but no org', async () => {
    expect(await getUserRole(makeSupabase('u1', [], [{ id: 'e1' }]))).toBe('employee')
  })

  it('returns none when user exists but has no org and no employee row', async () => {
    expect(await getUserRole(makeSupabase('u1', [], []))).toBe('none')
  })

  it('returns manager even if employee row also exists (org takes priority)', async () => {
    expect(await getUserRole(makeSupabase('u1', [{ id: 'o1' }], [{ id: 'e1' }]))).toBe('manager')
  })

  it('returns employee for a multi-workplace user (2 employee rows)', async () => {
    // Regression: previously .maybeSingle() threw PGRST116 → role resolved to
    // 'none' and locked the user. With .limit(1) + array length this stays 'employee'.
    const supabase = makeSupabase('u1', [], [{ id: 'e1' }, { id: 'e2' }])
    expect(await getUserRole(supabase)).toBe('employee')
  })
})

describe('resolveUserRole', () => {
  it('returns the resolved user alongside the role', async () => {
    const supabase = makeSupabase('u1', [{ id: 'o1' }], [])
    const { user, role } = await resolveUserRole(supabase)
    expect(role).toBe('manager')
    expect(user?.id).toBe('u1')
  })

  it('skips auth.getUser when a pre-resolved user is passed', async () => {
    const supabase = makeSupabase('u1', [], [{ id: 'e1' }])
    const preUser = { id: 'u1' } as never
    const { role } = await resolveUserRole(supabase, preUser)
    expect(role).toBe('employee')
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
  })

  it('treats explicit null pre-user as unauthenticated without calling getUser', async () => {
    const supabase = makeSupabase('u1', [{ id: 'o1' }], [])
    const { role } = await resolveUserRole(supabase, null)
    expect(role).toBe('none')
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
  })
})
