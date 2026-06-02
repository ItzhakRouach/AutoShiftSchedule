import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 22px 40px',
        background: 'var(--bg)',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 34 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 12px 30px rgba(52,87,240,0.35)',
          }}
        >
          <Icon name="shield" size={34} stroke={1.7} color="#fff" />
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-1px',
          }}
        >
          מִשְׁמֶרֶת
        </h1>
        <p
          style={{
            margin: '8px auto 0',
            fontSize: 14.5,
            color: 'var(--text-2)',
            lineHeight: 1.5,
            maxWidth: 250,
          }}
        >
          שיבוץ משמרות אוטומטי לפי בקשות העובדים, תפקידים וזמני מנוחה.
        </p>
      </div>

      {/* Role cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 11,
          width: '100%',
          maxWidth: 380,
        }}
      >
        <RoleCard
          href="/login?as=manager"
          icon="chart"
          iconBg="var(--accent)"
          title="כניסת מנהל"
          subtitle="דשבורד, שיבוץ אוטומטי וניהול עובדים"
        />
        <RoleCard
          href="/login?as=employee"
          icon="user"
          iconBg="#13A98E"
          title="כניסת עובד"
          subtitle="הזנת בקשות וצפייה בסידור"
        />
      </div>
    </main>
  )
}

function RoleCard({
  href,
  icon,
  iconBg,
  title,
  subtitle,
}: {
  href: string
  icon: 'chart' | 'user'
  iconBg: string
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 15,
        padding: '18px 18px',
        width: '100%',
        textAlign: 'start',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow)',
        textDecoration: 'none',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 'var(--r-md)',
          background: iconBg,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={28} stroke={1.9} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <Icon name="chevronLeft" size={20} color="var(--text-3)" />
    </Link>
  )
}
