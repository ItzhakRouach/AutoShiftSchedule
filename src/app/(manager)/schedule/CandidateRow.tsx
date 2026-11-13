'use client'

export type CandTone = 'requested' | 'available' | 'override' | 'blocked'

const TONE: Record<CandTone, { border: string; bg: string; ink: string }> = {
  requested: { border: 'var(--success)', bg: 'var(--success-soft)', ink: 'var(--text-2)' },
  available: { border: 'var(--border)', bg: 'var(--surface)', ink: 'var(--text-2)' },
  override: { border: 'var(--warning)', bg: 'var(--warning-soft)', ink: 'var(--text)' },
  blocked: { border: 'transparent', bg: 'var(--surface-sunk)', ink: 'var(--text-2)' },
}

interface Props {
  name: string
  color: string
  tone: CandTone
  /** The worker's week so far ("4 משמרות השבוע · לילה אחד"). */
  stats?: string
  /** Shown beside the stats when the worker already carries more than most. */
  aboveAverage?: boolean
  /** Why this row needs approval, or why it cannot be picked. */
  reason?: string
  /** The call to action; omitted on rows that cannot be picked. */
  action?: string
  disabled: boolean
  onClick?: () => void
}

/**
 * One worker in the assign window: name, their week so far (so the fairest
 * pick is visible without leaving the window), any reason, and the action.
 * The whole row is the button.
 */
export function CandidateRow({ name, color, tone, stats, aboveAverage, reason, action, disabled, onClick }: Props) {
  const t = TONE[tone]
  return (
    <button
      type="button"
      data-testid="candidate-row"
      data-tone={tone}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start',
        padding: '9px 12px', borderRadius: 'var(--r-sm)', border: `1.5px solid ${t.border}`, background: t.bg,
        cursor: disabled ? 'default' : 'pointer', fontFamily: 'var(--font)', color: 'var(--text)',
        opacity: disabled && tone !== 'blocked' ? 0.55 : 1,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--text-h3)', fontWeight: 700 }}>{name}</span>
        {reason && <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: t.ink }}>{reason}</span>}
        {stats && (
          <span className="tabular" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
            {stats}
            {aboveAverage && <strong style={{ color: 'var(--warning)' }}> · מעל הממוצע</strong>}
          </span>
        )}
      </span>
      {action && (
        <span
          style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: 'var(--r-sm)', fontSize: 'var(--text-body)', fontWeight: 700,
            ...(tone === 'override'
              ? { border: '1px solid var(--warning)', background: 'var(--surface)', color: 'var(--text)' }
              : { background: 'var(--accent)', color: 'var(--accent-ink)' }),
          }}
        >
          {action}
        </span>
      )}
    </button>
  )
}
