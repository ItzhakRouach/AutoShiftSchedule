'use client'

interface CapNumberFieldProps {
  id: string
  name: string
  label: string
  /** Helper line under the input explaining what the cap does. */
  hint: string
  min: number
  max: number
  /** `null` renders empty = "ללא הגבלה". */
  defaultValue: number | null
  error?: string
}

/** One nullable numeric cap row in the request-deadline form (empty = no limit).
 *  Shared by the off-day caps and the request-day cap so they look identical. */
export function CapNumberField({ id, name, label, hint, min, max, defaultValue, error }: CapNumberFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
        {label} <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(ריק = ללא הגבלה)</span>
      </label>
      <input
        id={id}
        type="number"
        name={name}
        min={min}
        max={max}
        defaultValue={defaultValue ?? ''}
        placeholder="ללא הגבלה"
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 15,
          fontFamily: 'var(--font)',
        }}
      />
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{hint}</span>
      {error && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}
    </div>
  )
}
