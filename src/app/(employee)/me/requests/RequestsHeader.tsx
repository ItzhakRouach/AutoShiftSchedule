import React from 'react'
import { Icon } from '@/components/ui/Icon'

interface RequestsHeaderProps {
  weekLabel: string
  filled: number
  total: number
  isReadOnly: boolean
  deadlineLabel?: string | null
}

export function RequestsHeader({ weekLabel, filled, total, isReadOnly, deadlineLabel }: RequestsHeaderProps) {
  const pct = Math.round((filled / Math.max(total, 1)) * 100)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '6px 2px 18px',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 3 }}>
            שבוע {weekLabel}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.8px',
            }}
          >
            הבקשות שלי
          </h1>
        </div>
      </div>

      {isReadOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 14px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(220,70,70,0.1)',
            border: '1px solid rgba(220,70,70,0.25)',
            marginBottom: 16,
          }}
        >
          {/* warning-triangle is not in Icon registry — kept inline */}
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D8423B"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 4 21 19.5H3L12 4Z" />
            <path d="M12 10v4.2M12 17.2v.1" />
          </svg>
          <div style={{ fontSize: 13, color: '#D8423B', fontWeight: 600 }}>
            חלון הגשת הבקשות נסגר — הסידור נעול
          </div>
        </div>
      )}

      {!isReadOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 14px',
            borderRadius: 'var(--r-md)',
            background: 'var(--accent-soft)',
            marginBottom: 16,
          }}
        >
          <Icon name="info" size={20} color="var(--accent)" />
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>
            לחצו על יום כדי לבחור משמרות מועדפות או לסמן יום חופש. ניתן לבחור יותר ממשמרת אחת.
          </div>
        </div>
      )}

      {!isReadOnly && deadlineLabel && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 'var(--r-md)',
            background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: 16,
          }}
        >
          <Icon name="clock" size={18} color="var(--text-2)" />
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
            חלון ההגשה נסגר ב{deadlineLabel}
          </div>
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
        {filled === total ? 'כל הימים מולאו ✓' : `מולאו ${filled} מתוך ${total} ימים`}
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: 'var(--surface-sunk)',
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 99,
            background: 'var(--accent)',
            transition: 'width .4s ease',
          }}
        />
      </div>
    </div>
  )
}
