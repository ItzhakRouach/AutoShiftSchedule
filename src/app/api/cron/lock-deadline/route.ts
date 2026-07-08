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
import { remindMissingRequests } from '@/lib/push/remind'

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
    const now = new Date()
    const result = await lockExpiredPeriods(admin, now)

    // Best-effort: also nudge employees whose deadline is within ~24h and who
    // haven't submitted yet — folded into this daily cron (Hobby caps at 2).
    // Isolated so a reminder failure never breaks the (critical) lock step.
    let reminded = 0
    try {
      const remind = await remindMissingRequests(admin, now)
      reminded = remind.reminded
      if (remind.errors.length > 0) console.error('[remind] errors:', remind.errors)
    } catch (err) {
      console.error('[remind] failed:', err)
    }

    if (result.errors.length > 0) console.error('[lock-deadline] errors:', result.errors)

    return NextResponse.json({ locked: result.locked, reminded, errors: result.errors })
  } catch (err) {
    console.error('[lock-deadline] unexpected error:', err)
    return NextResponse.json({ error: 'lock failed' }, { status: 500 })
  }
}
