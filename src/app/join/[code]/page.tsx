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
  searchParams: Promise<{ e?: string }>
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

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  const { code } = await params
  const { e: pendingEmployeeId } = await searchParams

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

  // Prefill name/phone from the pending employee the manager created for this
  // invite (the wa.me link carries ?e=<id>). Only an UNCLAIMED pending row in
  // THIS workplace is used, so the link can't leak another workplace's data.
  let prefillName = ''
  let prefillPhone = ''
  // Only a validated id (this workplace, still unclaimed) is passed on to the
  // join actions, where it claims the manager-created row by id.
  let validPendingId: string | undefined
  if (pendingEmployeeId) {
    const { data: pending } = await admin
      .from('employees')
      .select('name, phone, workplace_id, user_id')
      .eq('id', pendingEmployeeId)
      .maybeSingle()
    if (pending && pending.workplace_id === invite.workplace_id && !pending.user_id) {
      prefillName = pending.name ?? ''
      prefillPhone = pending.phone ?? ''
      validPendingId = pendingEmployeeId
    }
  }

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

    // Employee of ANOTHER workplace — an account can belong to one workplace
    // only (employees_user_unique). Say so up front instead of letting them
    // fill a form that joinAsCurrentUser will always reject.
    return (
      <main style={pageStyle}>
        <div style={{ ...cardStyle, padding: 40, maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800 }}>
            החשבון כבר משויך
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
            חשבון זה משויך כבר למקום עבודה אחר, וניתן להיות עובד במקום אחד בלבד.
            כדי להצטרף ל{workplaceName} התנתקו וצרו חשבון נפרד עם אימייל אחר.
          </p>
        </div>
      </main>
    )
  }

  // Authenticated, role `none` → show join panel that reuses their existing
  // account (no email/password fields).
  if (user) {
    const boundAction = joinAsCurrentUser.bind(null, code, validPendingId)
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>
            הצטרפות ל{workplaceName}
          </h1>
          <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 14 }}>
            הצטרף לצוות עם החשבון הקיים שלך
          </p>
          <CurrentUserJoinForm action={boundAction} workplaceName={workplaceName} initialName={prefillName} initialPhone={prefillPhone} />
        </div>
      </main>
    )
  }

  // Not authenticated → classic signup form
  const boundAction = joinWithInvite.bind(null, code, validPendingId)
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>
          הצטרפות ל{workplaceName}
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 14 }}>
          צור חשבון כדי להצטרף לצוות
        </p>
        <JoinForm action={boundAction} initialName={prefillName} initialPhone={prefillPhone} />
      </div>
    </main>
  )
}
