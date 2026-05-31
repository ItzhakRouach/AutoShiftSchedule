/**
 * Cron route: publish schedule_periods that are due today (per workplace settings).
 *
 * Scheduled via vercel.json: "0 5 * * *" (daily at 05:00 UTC).
 * Auth: Bearer token must match CRON_SECRET env var.
 * Vercel automatically sends this header when invoking configured cron jobs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publishDuePeriods } from '@/lib/publish/run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const result = await publishDuePeriods(admin, new Date())

    if (result.errors.length > 0) {
      console.error('[publish-cron] errors:', result.errors)
    }

    return NextResponse.json({
      published: result.published,
      sent: result.sent,
      errors: result.errors,
    })
  } catch (err) {
    console.error('[publish-cron] unexpected error:', err)
    return NextResponse.json({ error: 'publish failed' }, { status: 500 })
  }
}
