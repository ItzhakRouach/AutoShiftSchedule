/**
 * Unit tests for the publish cron route auth guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/publish/run', () => ({
  publishDuePeriods: vi.fn().mockResolvedValue({ published: 0, sent: 0, errors: [] }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
}))

const { GET } = await import('./route')

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) headers['authorization'] = authHeader
  return new NextRequest('http://localhost/api/cron/publish', { headers })
}

describe('GET /api/cron/publish', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-publish'
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

  it('returns 401 when not Bearer format', async () => {
    const res = await GET(makeRequest('Basic test-secret-publish'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with published/sent counts when token is correct', async () => {
    const { publishDuePeriods } = await import('@/lib/publish/run')
    vi.mocked(publishDuePeriods).mockResolvedValueOnce({ published: 2, sent: 1, errors: [] })

    const res = await GET(makeRequest('Bearer test-secret-publish'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.published).toBe(2)
    expect(body.sent).toBe(1)
    expect(body.errors).toHaveLength(0)
  })
})
