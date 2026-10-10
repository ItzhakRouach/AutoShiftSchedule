'use client'

import type { AiMetrics } from './ai-shared'

const ROWS: { key: keyof AiMetrics; label: string; lowerIsBetter: boolean }[] = [
  { key: 'filledSlots', label: 'משבצות מאוישות', lowerIsBetter: false },
  { key: 'requestsSatisfied', label: 'בקשות שאושרו', lowerIsBetter: false },
  { key: 'belowMinCount', label: 'עובדים מתחת למינימום', lowerIsBetter: true },
  { key: 'nightImbalanceCount', label: 'אי-איזון לילות', lowerIsBetter: true },
  { key: 'nightSpread', label: 'פער לילות (מקס׳−מינ׳)', lowerIsBetter: true },
  { key: 'managerRoleSpread', label: 'פער משמרות אחמ״ש', lowerIsBetter: true },
  { key: 'twelveHourCount', label: 'משמרות 12ש׳', lowerIsBetter: true },
]

/** Before/after comparison of the manager-facing metrics. A changed row is
 *  coloured by whether the change is an improvement for that metric. */
export function AiImproveReport({ before, after }: { before: AiMetrics; after: AiMetrics }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
      <thead>
        <tr style={{ color: 'var(--text-3)' }}>
          <th style={{ textAlign: 'start', fontWeight: 600, padding: '4px 0' }}>מדד</th>
          <th style={{ textAlign: 'center', fontWeight: 600 }}>לפני</th>
          <th style={{ textAlign: 'center', fontWeight: 600 }}>אחרי</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(({ key, label, lowerIsBetter }) => {
          const b = before[key]
          const a = after[key]
          const changed = a !== b
          const better = lowerIsBetter ? a < b : a > b
          const color = !changed ? 'var(--text-2)' : better ? 'var(--success)' : 'var(--danger)'
          const suffix = key === 'filledSlots' ? `/${after.requiredSlots}` : ''
          return (
            <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '5px 0', color: 'var(--text-2)' }}>{label}</td>
              <td style={{ textAlign: 'center', color: 'var(--text-2)' }}>
                {b}
                {suffix}
              </td>
              <td style={{ textAlign: 'center', color, fontWeight: changed ? 700 : 400 }}>
                {a}
                {suffix}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
