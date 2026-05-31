/**
 * Cron route: lock schedule_periods whose request deadline has passed.
 *
 * Scheduled via vercel.json: "0 2 * * *" (daily at 02:00 UTC).
 * NOTE: Vercel Hobby plan runs crons once per day maximum; for finer cadence
 * (e.g. hourly) upgrade to Pro and adjust the schedule expression.
 *
 * Auth: Bearer token in Authorization header must match CRON_SECRET env var.
 * Vercel automatically sends this header when invoking configured cron jobs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lockExpiredPeriods } from '@/lib/deadline/lock'

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
    const result = await lockExpiredPeriods(admin, new Date())

    if (result.errors.length > 0) {
      console.error('[lock-deadline] errors:', result.errors)
    }

    return NextResponse.json({ locked: result.locked, errors: result.errors })
  } catch (err) {
    console.error('[lock-deadline] unexpected error:', err)
    return NextResponse.json({ error: 'lock failed' }, { status: 500 })
  }
}
