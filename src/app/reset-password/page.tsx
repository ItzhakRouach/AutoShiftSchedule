import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from './ResetPasswordForm'

export const dynamic = 'force-dynamic'

/** Tell the user the recovery link is dead BEFORE they type a new password,
 *  instead of failing only on submit. */
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)', direction: 'rtl' }}>
        <div
          style={{
            background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)', borderRadius: 'var(--r-lg)', padding: 40,
            width: '100%', maxWidth: 400, textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800 }}>הקישור אינו תקף</h1>
          <p style={{ margin: '0 0 20px', color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
            קישור האיפוס פג תוקף או שנפתח בדפדפן אחר. אפשר לבקש קישור חדש.
          </p>
          <Link
            href="/forgot-password"
            style={{
              display: 'inline-block', background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--r-pill)', padding: '12px 28px', fontSize: 14, fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            בקשת קישור חדש
          </Link>
        </div>
      </main>
    )
  }

  return <ResetPasswordForm />
}
