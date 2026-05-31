import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const hasCredentials = Boolean(url && serviceKey && anonKey)

const suite = hasCredentials ? describe : describe.skip

suite('RLS isolation: organizations & workplaces', { timeout: 30000 }, () => {
  let admin: SupabaseClient
  let clientA: SupabaseClient
  let clientB: SupabaseClient

  let userAId: string
  let userBId: string
  let orgAId: string

  const emailA = `rls-test-a-${crypto.randomUUID()}@autoshiftschedule.test`
  const emailB = `rls-test-b-${crypto.randomUUID()}@autoshiftschedule.test`
  const password = 'Test1234!'

  beforeAll(async () => {
    // Build admin (service-role) client
    admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Create two test users via admin
    const { data: dataA, error: errA } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    })
    if (errA || !dataA.user) throw new Error(`Failed to create user A: ${errA?.message}`)
    userAId = dataA.user.id

    const { data: dataB, error: errB } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    })
    if (errB || !dataB.user) throw new Error(`Failed to create user B: ${errB?.message}`)
    userBId = dataB.user.id

    // Sign each user in with anon-key client
    clientA = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: signInErrA } = await clientA.auth.signInWithPassword({ email: emailA, password })
    if (signInErrA) throw new Error(`Failed to sign in user A: ${signInErrA.message}`)

    clientB = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: signInErrB } = await clientB.auth.signInWithPassword({ email: emailB, password })
    if (signInErrB) throw new Error(`Failed to sign in user B: ${signInErrB.message}`)
  })

  afterAll(async () => {
    // Best-effort cleanup — cascades to organizations/workplaces
    try {
      if (userAId) await admin.auth.admin.deleteUser(userAId)
    } catch { /* ignore */ }
    try {
      if (userBId) await admin.auth.admin.deleteUser(userBId)
    } catch { /* ignore */ }
  })

  it('user A can insert their own organization', async () => {
    const { data, error } = await clientA
      .from('organizations')
      .insert({ owner_user_id: userAId, name: 'A-org' })
      .select('id')
      .single()

    expect(error, `Insert error: ${error?.message}`).toBeNull()
    expect(data?.id).toBeTruthy()
    orgAId = data!.id
  })

  it("user B's organization list does NOT include user A's org (RLS isolation)", async () => {
    const { data, error } = await clientB
      .from('organizations')
      .select('id')

    // Could be null or empty array — neither should contain A's org
    expect(error).toBeNull()
    const ids = (data ?? []).map((r: { id: string }) => r.id)
    expect(ids).not.toContain(orgAId)
  })

  it('user B cannot fetch user A org by specific id (RLS isolation)', async () => {
    const { data, error } = await clientB
      .from('organizations')
      .select('id')
      .eq('id', orgAId)

    // RLS should return empty, not an error
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('service-role client can see user A org (bypasses RLS)', async () => {
    const { data, error } = await admin
      .from('organizations')
      .select('id')
      .eq('id', orgAId)
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBe(orgAId)
  })

  it('user B cannot insert an organization owned by user A (RLS with-check violation)', async () => {
    const { data, error } = await clientB
      .from('organizations')
      .insert({ owner_user_id: userAId, name: 'hack' })
      .select('id')

    // RLS with-check must block this: expect either an error OR zero rows inserted.
    // If rows come back, that is a real security bug — fail explicitly.
    if (!error && (data ?? []).length > 0) {
      throw new Error(
        `SECURITY BUG: user B was able to insert an org owned by user A. Rows: ${JSON.stringify(data)}`
      )
    }
    // At least one of: an error was returned, or no rows were inserted.
    expect(error !== null || (data ?? []).length === 0).toBe(true)
  })
})
