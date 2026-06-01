import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveUserRole } from '@/lib/auth/role'
import { joinWithInvite } from './actions'
import { joinAsCurrentUser } from './actions-current-user'
import { JoinForm } from './JoinForm'
import { CurrentUserJoinForm } from './CurrentUserJoinForm'

interface JoinPageProps {
  params: Promise<{ code: string }>
}

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
  borderRadius: 'var(--r-lg)',
  padding: 32,
  maxWidth: 440,
  width: '100%',
} as const

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  direction: 'rtl',
} as const

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params

  const supabase = await createClient()
  const { user, role } = await resolveUserRole(supabase)

  // Managers always go to their dashboard — no join needed.
  if (role === 'manager') redirect('/dashboard')

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: invite } = await admin
    .from('invites')
    .select('workplace_id')
    .eq('code', code.toUpperCase())
    .gt('expires_at', now)
    .maybeSingle()

  // Invalid / expired — same error for all users
  if (!invite) {
    return (
      <main style={pageStyle}>
        <div
          style={{
            ...cardStyle,
            padding: 40,
            maxWidth: 400,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800 }}>
            הזמנה לא תקפה
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
            הקוד אינו קיים או שפג תוקפו. בקשו קוד חדש מהמנהל.
          </p>
        </div>
      </main>
    )
  }

  const { data: workplace } = await admin
    .from('workplaces')
    .select('name')
    .eq('id', invite.workplace_id)
    .maybeSingle()

  const workplaceName = workplace?.name ?? ''

  // Authenticated employee — check if already in THIS workplace
  if (role === 'employee' && user) {
    const { data: existing } = await admin
      .from('employees')
      .select('id')
      .eq('workplace_id', invite.workplace_id)
      .eq('user_id', user.id)
      .maybeSingle()

    // Already in this workplace → just go to /me
    if (existing) redirect('/me')

    // Employee of another workplace — fall through to the authenticated panel
    // so they can join this one too (multi-workplace support).
  }

  // Authenticated, role `none` (or employee of another workplace) → show join
  // panel that reuses their existing account (no email/password fields).
  if (user) {
    const boundAction = joinAsCurrentUser.bind(null, code)
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>
            הצטרפות ל{workplaceName}
          </h1>
          <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 14 }}>
            הצטרף לצוות עם החשבון הקיים שלך
          </p>
          <CurrentUserJoinForm action={boundAction} workplaceName={workplaceName} />
        </div>
      </main>
    )
  }

  // Not authenticated → classic signup form
  const boundAction = joinWithInvite.bind(null, code)
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>
          הצטרפות ל{workplaceName}
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 14 }}>
          צור חשבון כדי להצטרף לצוות
        </p>
        <JoinForm action={boundAction} />
      </div>
    </main>
  )
}
