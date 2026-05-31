/**
 * Unit tests for the cron route auth guard.
 * Tests the 401 behaviour for missing / wrong CRON_SECRET without hitting the DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the lock module so we never touch the DB in this unit test
vi.mock('@/lib/deadline/lock', () => ({
  lockExpiredPeriods: vi.fn().mockResolvedValue({ locked: 0, errors: [] }),
}))

// Mock admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
}))

// Import AFTER mocks are set up
const { GET } = await import('./route')

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) headers['authorization'] = authHeader
  return new NextRequest('http://localhost/api/cron/lock-deadline', { headers })
}

describe('GET /api/cron/lock-deadline', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-abc'
  })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when token is wrong', async () => {
    const res = await GET(makeRequest('Bearer wrong-token'))
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization header is not Bearer format', async () => {
    const res = await GET(makeRequest('Basic test-secret-abc'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with locked count when token is correct', async () => {
    const { lockExpiredPeriods } = await import('@/lib/deadline/lock')
    vi.mocked(lockExpiredPeriods).mockResolvedValueOnce({ locked: 3, errors: [] })

    const res = await GET(makeRequest('Bearer test-secret-abc'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.locked).toBe(3)
    expect(body.errors).toHaveLength(0)
  })
})
