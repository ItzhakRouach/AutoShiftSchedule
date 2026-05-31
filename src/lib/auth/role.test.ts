import { describe, it, expect, vi } from 'vitest'
import { getUserRole } from './role'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeSupabase(userId: string | null, hasOrg: boolean, hasEmployee: boolean) {
  const fromMock = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {}

    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(async () => {
      if (table === 'organizations') return { data: hasOrg ? { id: 'org-1' } : null }
      if (table === 'employees') return { data: hasEmployee ? { id: 'emp-1' } : null }
      return { data: null }
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
    const supabase = makeSupabase(null, false, false)
    expect(await getUserRole(supabase)).toBe('none')
  })

  it('returns manager when user owns an organization', async () => {
    const supabase = makeSupabase('user-1', true, false)
    expect(await getUserRole(supabase)).toBe('manager')
  })

  it('returns employee when user has an employees row but no org', async () => {
    const supabase = makeSupabase('user-1', false, true)
    expect(await getUserRole(supabase)).toBe('employee')
  })

  it('returns none when user exists but has no org and no employee row', async () => {
    const supabase = makeSupabase('user-1', false, false)
    expect(await getUserRole(supabase)).toBe('none')
  })

  it('returns manager even if employee row also exists (org takes priority)', async () => {
    const supabase = makeSupabase('user-1', true, true)
    expect(await getUserRole(supabase)).toBe('manager')
  })
})
