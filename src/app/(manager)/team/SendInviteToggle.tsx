'use client'

/**
 * Tiny "send WhatsApp invite" checkbox shown beneath the new-employee form
 * when a phone is filled in. The server-side action gates on GreenAPI being
 * configured AND a phone being present, so this is purely an opt-in nudge —
 * unchecking when GreenAPI isn't set up is a safe no-op anyway.
 */
interface Props {
  checked: boolean
  onChange: (next: boolean) => void
}

export function SendInviteToggle({ checked, onChange }: Props) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 'var(--r-md)',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        cursor: 'pointer', fontSize: 14,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
      />
      <span style={{ flex: 1, color: 'var(--text)', fontWeight: 600 }}>
        שלח הזמנת WhatsApp אוטומטית
      </span>
    </label>
  )
}
