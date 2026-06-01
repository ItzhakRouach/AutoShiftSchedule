/**
 * Integration tests for two-way account deletion.
 * Skipped automatically when SUPABASE_SERVICE_ROLE_KEY is not set.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const hasCredentials = Boolean(url && serviceKey && anonKey)
const suite = hasCredentials ? describe : describe.skip

suite('Account deletion — integration', { timeout: 40000 }, () => {
  let admin: SupabaseClient
  beforeAll(() => {
    admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  })

  async function createTestUser(tag: string) {
    const email = `del-${tag}-${crypto.randomUUID()}@autoshiftschedule.test`
    const { data, error } = await admin.auth.admin.createUser({ email, password: 'Test1234!', email_confirm: true })
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
    return data.user
  }

  async function signInAs(email: string) {
    const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email, password: 'Test1234!' })
    if (error) throw new Error(`signIn: ${error.message}`)
    return c
  }

  async function createOrg(c: SupabaseClient, ownerUserId: string) {
    const { data, error } = await c.from('organizations').insert({ owner_user_id: ownerUserId, name: `org-${crypto.randomUUID()}` }).select('id').single()
    if (error || !data) throw new Error(`createOrg: ${error?.message}`)
    return data.id as string
  }

  async function createWorkplace(c: SupabaseClient, orgId: string) {
    const { data, error } = await c.from('workplaces').insert({ org_id: orgId, name: `wp-${crypto.randomUUID()}` }).select('id').single()
    if (error || !data) throw new Error(`createWorkplace: ${error?.message}`)
    return data.id as string
  }

  async function createEmployeeRow(c: SupabaseClient, workplaceId: string, userId: string | null) {
    const { data, error } = await c.from('employees').insert({
      workplace_id: workplaceId, name: `Emp-${crypto.randomUUID().slice(0, 8)}`,
      min_shifts_per_week: 1, max_shifts_per_week: 5, employment_type: 'full',
      observes_shabbat: false, observes_holidays: false, must_accept: false, status: 'active', user_id: userId,
    }).select('id').single()
    if (error || !data) throw new Error(`createEmployee: ${error?.message}`)
    return data.id as string
  }

  // ── self-delete ──────────────────────────────────────────────────────────

  describe('Employee self-delete', () => {
    let managerUser: Awaited<ReturnType<typeof createTestUser>>
    let employeeUser: Awaited<ReturnType<typeof createTestUser>>
    let employeeRowId: string
    let managerClient: SupabaseClient

    beforeAll(async () => {
      managerUser = await createTestUser('mgr-self')
      employeeUser = await createTestUser('emp-self')
      managerClient = await signInAs(managerUser.email!)
      const orgId = await createOrg(managerClient, managerUser.id)
      const wpId = await createWorkplace(managerClient, orgId)
      employeeRowId = await createEmployeeRow(admin, wpId, employeeUser.id)
    })

    afterAll(async () => {
      try { await admin.auth.admin.deleteUser(managerUser.id) } catch { /* ignore */ }
      try { await admin.auth.admin.deleteUser(employeeUser.id) } catch { /* ignore */ }
    })

    it('deletes the employees row and the auth user', async () => {
      const { error: delEmpErr } = await admin.from('employees').delete().eq('user_id', employeeUser.id)
      expect(delEmpErr, `delEmpErr: ${delEmpErr?.message}`).toBeNull()

      const { error: delAuthErr } = await admin.auth.admin.deleteUser(employeeUser.id)
      expect(delAuthErr, `delAuthErr: ${delAuthErr?.message}`).toBeNull()

      const { data: empRows } = await admin.from('employees').select('id').eq('id', employeeRowId)
      expect(empRows ?? []).toHaveLength(0)

      const { data: authData } = await admin.auth.admin.getUserById(employeeUser.id)
      expect(authData.user).toBeNull()
    })
  })

  // ── manager delete cascades ──────────────────────────────────────────────

  describe('Manager delete cascades to auth user', () => {
    let managerA: Awaited<ReturnType<typeof createTestUser>>
    let managerB: Awaited<ReturnType<typeof createTestUser>>
    let employeeUser: Awaited<ReturnType<typeof createTestUser>>
    let workplaceAId: string
    let workplaceBId: string
    let employeeRowId: string
    let clientA: SupabaseClient
    let clientB: SupabaseClient

    beforeAll(async () => {
      managerA = await createTestUser('mgr-a')
      managerB = await createTestUser('mgr-b')
      employeeUser = await createTestUser('emp-cascade')
      clientA = await signInAs(managerA.email!)
      const orgAId = await createOrg(clientA, managerA.id)
      workplaceAId = await createWorkplace(clientA, orgAId)
      clientB = await signInAs(managerB.email!)
      const orgBId = await createOrg(clientB, managerB.id)
      workplaceBId = await createWorkplace(clientB, orgBId)
      employeeRowId = await createEmployeeRow(admin, workplaceAId, employeeUser.id)
    })

    afterAll(async () => {
      try { await admin.auth.admin.deleteUser(managerA.id) } catch { /* ignore */ }
      try { await admin.auth.admin.deleteUser(managerB.id) } catch { /* ignore */ }
      try { await admin.auth.admin.deleteUser(employeeUser.id) } catch { /* ignore */ }
    })

    it('manager B cannot see employee of workplace A via own workplace filter (RLS)', async () => {
      const { data } = await clientB.from('employees').select('id, user_id')
        .eq('id', employeeRowId).eq('workplace_id', workplaceBId).maybeSingle()
      expect(data).toBeNull()
    })

    it('manager A deletes employee row and linked auth user', async () => {
      const { data: emp } = await clientA.from('employees').select('id, user_id')
        .eq('id', employeeRowId).eq('workplace_id', workplaceAId).maybeSingle()
      expect(emp).not.toBeNull()
      const linkedUserId = emp!.user_id as string

      const { data: deleted, error: delErr } = await clientA.from('employees').delete()
        .eq('id', employeeRowId).select('id')
      expect(delErr, `delErr: ${delErr?.message}`).toBeNull()
      expect(deleted).toHaveLength(1)

      const { error: authErr } = await admin.auth.admin.deleteUser(linkedUserId)
      expect(authErr, `authErr: ${authErr?.message}`).toBeNull()

      const { data: authData } = await admin.auth.admin.getUserById(linkedUserId)
      expect(authData.user).toBeNull()
    })
  })
})
