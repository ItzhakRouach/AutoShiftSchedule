import Link from 'next/link'
import { signOut } from '@/app/(auth)/actions'

function NavLink({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        background: primary ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: primary ? 'var(--accent)' : 'var(--text)',
        borderRadius: 'var(--r-md)',
        fontWeight: 700,
        fontSize: 15,
        textDecoration: 'none',
        border: `1px solid ${primary ? 'transparent' : 'var(--border)'}`,
      }}
    >
      <span>{label}</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: 'scaleX(-1)' }}
      >
        <path d="M14.5 5 8 12l6.5 7" />
      </svg>
    </Link>
  )
}

export function DashNav() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
      <NavLink href="/team" label="ניהול עובדים" primary />
      <NavLink href="/schedule" label="שיבוץ" />
      <NavLink href="/settings" label="הגדרות" />
      <form action={signOut}>
        <button
          type="submit"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-pill)',
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginTop: 4,
          }}
        >
          יציאה
        </button>
      </form>
    </div>
  )
}
