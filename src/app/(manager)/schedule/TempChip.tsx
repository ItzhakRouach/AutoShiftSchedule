'use client'

interface Props {
  name: string
  assignmentId: string
  /** Remove the temp entry by id (omitted in read-only views). */
  onRemove?: (assignmentId: string) => void
  /** 'pill' for the day cards, 'plain' for the dense week-table cell. */
  variant?: 'pill' | 'plain'
}

/** An ad-hoc "temp" worker chip (no roster employee) with an optional remove ×.
 *  Shared by the week table cell and the mobile day cards. */
export function TempChip({ name, assignmentId, onRemove, variant = 'plain' }: Props) {
  const pill = variant === 'pill'
  return (
    <span
      title="עובד זמני"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: pill ? 6 : 4,
        justifyContent: 'center', color: 'var(--text-2)', fontWeight: 700,
        fontSize: pill ? 13 : 12.5, lineHeight: 1.4,
        padding: pill ? '5px 11px' : '1px 6px',
        borderRadius: pill ? 99 : 8,
        border: '1px dashed var(--border-strong, var(--border))',
        background: pill ? 'var(--surface-2)' : undefined,
      }}
    >
      {name}
      {onRemove && assignmentId && (
        <button
          aria-label={`הסר ${name}`}
          onClick={(ev) => { ev.stopPropagation(); onRemove(assignmentId) }}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EB6A4E', fontWeight: 800, fontSize: pill ? 14 : 13, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      )}
    </span>
  )
}
