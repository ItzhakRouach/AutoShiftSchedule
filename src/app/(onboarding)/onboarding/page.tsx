import { signOut } from '@/app/(auth)/actions'

export default function OnboardingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          borderRadius: 'var(--r-lg)',
          padding: 32,
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800 }}>
          הקמת מקום עבודה — בקרוב
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--text-2)', fontSize: 14 }}>
          אשף הגדרת מקום העבודה יהיה זמין בקרוב.
        </p>
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
    </main>
  )
}
