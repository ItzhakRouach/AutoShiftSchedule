import { signOut } from '@/app/(auth)/actions'

export function DashNav() {
  return (
    <div style={{ marginTop: 8 }}>
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
          }}
        >
          יציאה
        </button>
      </form>
    </div>
  )
}
