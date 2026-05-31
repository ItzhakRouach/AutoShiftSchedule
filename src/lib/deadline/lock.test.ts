/**
 * Integration tests for lockExpiredPeriods.
 * Uses the real admin client + Supabase cloud (env from .env.local via vitest.setup.ts).
 * Creates and cleans up test data in the live DB including a throwaway auth user.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'
import { lockExpiredPeriods } from './lock'

const admin = createAdminClient()

let testUserId: string
let orgId: string
let workplaceId: string
let pastPeriodId: string
let futurePeriodId: string

// A Sunday well in the past → deadline was definitely before now
const PAST_WEEK_START = '2026-01-04'   // Sunday Jan 4 2026
// A Sunday far in the future → deadline not yet reached
const FUTURE_WEEK_START = '2027-01-03' // Sunday Jan 3 2027

// Deadline: Thursday (dow=4) @ 18:00
const DEADLINE_DOW = 4
const DEADLINE_TIME = '18:00'

beforeAll(async () => {
  // 1. Create a throwaway auth user via the admin API
  const email = `test-lock-${Date.now()}@autoshiftschedule.test`
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: 'TestPass123!',
    email_confirm: true,
  })
  if (authErr) throw new Error(`auth user create: ${authErr.message}`)
  testUserId = authData.user.id

  // 2. Create org + workplace
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ owner_user_id: testUserId, name: '__test_lock_org__' })
    .select('id')
    .single()
  if (orgErr) throw new Error(`org insert: ${orgErr.message}`)
  orgId = org.id

  const { data: wp, error: wpErr } = await admin
    .from('workplaces')
    .insert({ org_id: orgId, name: '__test_lock_wp__' })
    .select('id')
    .single()
  if (wpErr) throw new Error(`workplace insert: ${wpErr.message}`)
  workplaceId = wp.id

  // 3. Set workplace_settings with deadline
  const { error: settingsErr } = await admin
    .from('workplace_settings')
    .upsert({
      workplace_id: workplaceId,
      request_deadline_dow: DEADLINE_DOW,
      request_deadline_time: DEADLINE_TIME,
    })
  if (settingsErr) throw new Error(`settings upsert: ${settingsErr.message}`)

  // 4. Create past period (collecting) — should be locked
  const { data: pastP, error: pastErr } = await admin
    .from('schedule_periods')
    .insert({ workplace_id: workplaceId, week_start_date: PAST_WEEK_START, status: 'collecting' })
    .select('id')
    .single()
  if (pastErr) throw new Error(`past period insert: ${pastErr.message}`)
  pastPeriodId = pastP.id

  // 5. Create future period (collecting) — should stay collecting
  const { data: futureP, error: futureErr } = await admin
    .from('schedule_periods')
    .insert({
      workplace_id: workplaceId,
      week_start_date: FUTURE_WEEK_START,
      status: 'collecting',
    })
    .select('id')
    .single()
  if (futureErr) throw new Error(`future period insert: ${futureErr.message}`)
  futurePeriodId = futureP.id
})

afterAll(async () => {
  // Clean up in reverse dependency order
  if (workplaceId) {
    await admin.from('schedule_periods').delete().eq('workplace_id', workplaceId)
    await admin.from('workplace_settings').delete().eq('workplace_id', workplaceId)
    await admin.from('workplaces').delete().eq('id', workplaceId)
  }
  if (orgId) await admin.from('organizations').delete().eq('id', orgId)
  if (testUserId) await admin.auth.admin.deleteUser(testUserId)
})

describe('lockExpiredPeriods', () => {
  it('locks the past-deadline period and leaves the future period as collecting', async () => {
    const now = new Date()

    const result = await lockExpiredPeriods(admin, now)
    expect(result.errors).toHaveLength(0)
    expect(result.locked).toBeGreaterThanOrEqual(1)

    // Verify past period is now locked
    const { data: past } = await admin
      .from('schedule_periods')
      .select('status')
      .eq('id', pastPeriodId)
      .single()
    expect(past?.status).toBe('locked')

    // Verify future period is still collecting
    const { data: future } = await admin
      .from('schedule_periods')
      .select('status')
      .eq('id', futurePeriodId)
      .single()
    expect(future?.status).toBe('collecting')
  })

  it('does not re-lock an already-locked period (idempotent)', async () => {
    const now = new Date()
    // Past period is now locked; future is still collecting
    // Running again should lock 0 new periods (past skipped; future deadline not reached)
    const result = await lockExpiredPeriods(admin, now)
    expect(result.errors).toHaveLength(0)
    expect(result.locked).toBe(0)
  })
})
