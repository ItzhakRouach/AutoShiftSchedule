import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', borderRadius: 'var(--r-lg)', padding: 32, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>מִשְׁמֶרֶת</h1>
        <p style={{ color: 'var(--text-2)', marginTop: 8, marginBottom: 28 }}>שיבוץ משמרות אוטומטי — בקרוב.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link
            href="/login"
            style={{
              display: 'block',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              borderRadius: 'var(--r-pill)',
              padding: '12px 0',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            התחברות
          </Link>
          <Link
            href="/signup"
            style={{
              display: 'block',
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-pill)',
              padding: '12px 0',
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            הרשמה
          </Link>
        </div>
      </div>
    </main>
  )
}
