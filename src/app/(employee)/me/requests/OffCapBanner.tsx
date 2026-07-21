'use client'

interface OffCapBannerProps {
  /** Off-days the employee has ALREADY taken in this period. */
  current: number
  /** Workplace cap on off-days per period. */
  cap: number
}

/** Banner showing "ימי חופש בשבוע זה: X מתוך Y", with a warning once the cap
 *  is reached. Rendered only when a cap is configured (see DayList). */
export function OffCapBanner({ current, cap }: OffCapBannerProps) {
  const reached = current >= cap
  return (
    <div
      data-testid="off-cap-banner"
      style={{
        marginBottom: 12, padding: '9px 14px', borderRadius: 'var(--r-md)',
        background: reached ? 'rgba(245,158,11,0.12)' : 'var(--surface-2)',
        border: `1px solid ${reached ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
        fontSize: 13, color: 'var(--text)', fontWeight: 600,
      }}
    >
      ימי חופש בשבוע זה: <b>{current}</b> מתוך <b>{cap}</b>
      {reached && (
        <span style={{ marginInlineStart: 8, color: 'var(--warning)' }}>· הגעת למקסימום</span>
      )}
    </div>
  )
}
