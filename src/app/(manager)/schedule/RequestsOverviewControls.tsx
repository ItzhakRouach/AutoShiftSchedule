'use client'

const clearBtn = (danger: boolean): React.CSSProperties => ({
  fontSize: 12.5, fontWeight: 700, padding: '5px 12px', borderRadius: 'var(--r-pill)',
  border: `1px solid ${danger ? 'var(--danger)' : 'var(--border-strong)'}`,
  background: danger ? 'var(--danger-soft)' : 'var(--surface)',
  color: danger ? 'var(--danger)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--font)',
})

interface Props {
  submitted: number
  total: number
  offTotal: number
  offEmployees: number
  hasRequests: boolean
  confirmClear: boolean
  clearing: boolean
  onClearAll: () => void
  onConfirmClear: () => void
  onCancelClear: () => void
}

/** Header bar above the requests table: submission progress, off-days summary,
 *  and the "clear all" confirm flow. Split out of RequestsOverview to keep
 *  that component ≤200 lines. */
export function RequestsOverviewControls({
  submitted, total, offTotal, offEmployees, hasRequests,
  confirmClear, clearing, onClearAll, onConfirmClear, onCancelClear,
}: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, direction: 'rtl' }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)' }}>
        הגישו {submitted}/{total} עובדים
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· לחצו על משבצת כדי להוסיף/לערוך בקשה</span>
      {offTotal > 0 && (
        <span
          data-testid="off-requests-summary"
          title="כמות בקשות 'יום חופש / לא זמין' השבוע"
          style={{
            fontSize: 12.5, fontWeight: 700, color: 'var(--vacation)',
            background: 'var(--vacation-soft)', padding: '4px 10px', borderRadius: 99,
          }}
        >
          {offTotal} ימי חופש · {offEmployees} עובדים
        </span>
      )}
      {hasRequests && (
        <span style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 6 }}>
          {confirmClear ? (
            <>
              <button onClick={onClearAll} disabled={clearing} style={clearBtn(true)}>
                {clearing ? 'מנקה…' : 'בטוח? נקה הכל'}
              </button>
              <button onClick={onCancelClear} disabled={clearing} style={clearBtn(false)}>ביטול</button>
            </>
          ) : (
            <button onClick={onConfirmClear} style={clearBtn(false)}>נקה הכל</button>
          )}
        </span>
      )}
    </div>
  )
}
