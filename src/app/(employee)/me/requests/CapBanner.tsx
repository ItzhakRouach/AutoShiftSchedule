'use client'

interface CapBannerProps {
  /** Leading label, e.g. "ימי חופש בשבוע זה" / "ימי בקשות בשבוע זה". */
  label: string
  /** How many of the cap the employee has ALREADY used this period. */
  current: number
  /** The configured cap (render only when one exists — see DayList). */
  cap: number
  testId: string
}

/** Banner showing "<label>: X מתוך Y", with a warning once the cap is reached.
 *  Shared by the off-day cap and the request-day cap. */
export function CapBanner({ label, current, cap, testId }: CapBannerProps) {
  const reached = current >= cap
  return (
    <div
      data-testid={testId}
      style={{
        marginBottom: 12, padding: '9px 14px', borderRadius: 'var(--r-md)',
        background: reached ? 'rgba(245,158,11,0.12)' : 'var(--surface-2)',
        border: `1px solid ${reached ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
        fontSize: 13, color: 'var(--text)', fontWeight: 600,
      }}
    >
      {label}: <b>{current}</b> מתוך <b>{cap}</b>
      {reached && (
        <span style={{ marginInlineStart: 8, color: 'var(--warning)' }}>· הגעת למקסימום</span>
      )}
    </div>
  )
}
