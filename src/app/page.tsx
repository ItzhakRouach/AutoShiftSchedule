export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', borderRadius: 'var(--r-lg)', padding: 28, maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>מִשְׁמֶרֶת</h1>
        <p style={{ color: 'var(--text-2)', marginTop: 8 }}>שיבוץ משמרות אוטומטי — בקרוב.</p>
      </div>
    </main>
  );
}
