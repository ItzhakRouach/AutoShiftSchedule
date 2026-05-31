import { createAdminClient } from '@/lib/supabase/admin'
import { joinWithInvite } from './actions'
import { JoinForm } from './JoinForm'

interface JoinPageProps {
  params: Promise<{ code: string }>
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params
  const admin = createAdminClient()

  const now = new Date().toISOString()
  const { data: invite } = await admin
    .from('invites')
    .select('workplace_id')
    .eq('code', code.toUpperCase())
    .gt('expires_at', now)
    .maybeSingle()

  if (!invite) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          direction: 'rtl',
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            borderRadius: 'var(--r-lg)',
            padding: 40,
            maxWidth: 400,
            width: '100%',
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
  const boundAction = joinWithInvite.bind(null, code)

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        direction: 'rtl',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          borderRadius: 'var(--r-lg)',
          padding: 32,
          maxWidth: 440,
          width: '100%',
        }}
      >
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>
          הצטרפות ל{workplaceName}
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 14 }}>
          צור חשבון כדי להצטרף לצוות
        </p>

        <JoinForm code={code} action={boundAction} />
      </div>
    </main>
  )
}
