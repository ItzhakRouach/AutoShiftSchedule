import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import type { PeriodKPIs } from '@/lib/stats/types'

const COLOR_MAP = {
  green: { text: '#13A98E', bg: 'rgba(19,169,142,0.1)', border: 'rgba(19,169,142,0.25)', label: 'כיסוי מלא' },
  amber: { text: '#E0902A', bg: 'rgba(224,144,42,0.1)', border: 'rgba(224,144,42,0.25)', label: 'כיסוי חלקי' },
  red:   { text: '#EB6A4E', bg: 'rgba(235,106,78,0.1)', border: 'rgba(235,106,78,0.25)', label: 'כיסוי נמוך' },
}

interface Props {
  kpis: PeriodKPIs
}

export function CoverageCard({ kpis }: Props) {
  const { coveragePct, coverageColor, filledSlots, requiredSlots } = kpis
  const theme = COLOR_MAP[coverageColor]
  const noData = coveragePct === null

  return (
    <Card
      style={{
        marginBottom: 16,
        background: noData ? 'var(--surface)' : theme.bg,
        border: `1px solid ${noData ? 'var(--border)' : theme.border}`,
      }}
      pad={18}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: big % */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: noData ? 'var(--text-3)' : theme.text, letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
            כיסוי השיבוץ
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, letterSpacing: '-2px', color: noData ? 'var(--text-3)' : theme.text }}>
              {noData ? '—' : `${coveragePct}%`}
            </span>
          </div>
          {!noData && (
            <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginTop: 5, opacity: 0.85 }}>
              {filledSlots}/{requiredSlots} משבצות · {theme.label}
            </div>
          )}
          {noData && (
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500, marginTop: 5 }}>
              אין תקופה מוגדרת עדיין
            </div>
          )}
        </div>

        {/* Right: icon badge */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: noData ? 'var(--surface-sunk)' : theme.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon
            name={noData ? 'info' : coverageColor === 'green' ? 'shield' : 'alert'}
            size={26}
            stroke={2}
            color={noData ? 'var(--text-3)' : theme.text}
          />
        </div>
      </div>

      {/* Progress bar */}
      {!noData && (
        <div style={{ marginTop: 14, height: 8, borderRadius: 99, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, coveragePct ?? 0)}%`,
              height: '100%',
              borderRadius: 99,
              background: theme.text,
              transition: 'width .6s ease',
            }}
          />
        </div>
      )}
    </Card>
  )
}
