'use client'

import { Icon } from '@/components/ui/Icon'
import type { FeasibilityResult } from '@/lib/scheduling/types'

interface Props {
  feasibility: FeasibilityResult | null
}

/** Hebrew feasibility banner derived from feasibility.status. */
export function FeasibilityBanner({ feasibility }: Props) {
  if (!feasibility) return null

  let bg: string
  let color: string
  let icon: 'checkCircle' | 'shield' | 'info'
  let text: string

  if (feasibility.status === 'ok') {
    bg = 'rgba(19,169,142,0.12)'
    color = '#13A98E'
    icon = 'checkCircle'
    text = 'יש מספיק עובדים למשמרות הרגילות'
  } else if (feasibility.status === 'needs12h') {
    bg = 'rgba(242,169,59,0.13)'
    color = '#E0902A'
    icon = 'shield'
    text = `חסרים ${feasibility.shortBy} שיבוצים — ייתכן שיידרשו משמרות 12 שעות`
  } else {
    bg = 'rgba(235,106,78,0.12)'
    color = '#EB6A4E'
    icon = 'info'
    text = `חסרים ${feasibility.shortBy} שיבוצים — לא ניתן לאייש את כל המשמרות`
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 14px',
        borderRadius: 'var(--r-md)',
        background: bg,
        marginBottom: 14,
      }}
    >
      <Icon name={icon} size={20} color={color} />
      <div style={{ fontSize: 13.5, color: 'var(--text)', flex: 1, lineHeight: 1.4, fontWeight: 600 }}>
        {text}
      </div>
    </div>
  )
}
