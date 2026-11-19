'use client'

import { dayTitle } from '@/lib/domain/days'
import { SHIFT_META } from '@/lib/domain/constants'
import type { AiChange } from './ai-shared'

interface Props {
  changes: AiChange[]
  empById: Map<string, { name: string; color: string }>
}

/** Preview of every cell the AI proposes to change, before anything is saved.
 *  A swap shows as its two cells, each "who leaves → who takes it". */
export function AiImproveChanges({ changes, empById }: Props) {
  const name = (id: string) => empById.get(id)?.name ?? '?'
  return (
    <div data-testid="ai-improve-changes" style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        השינויים המוצעים
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {changes.map((c, i) => {
          const meta = SHIFT_META[c.shift]
          // `why` belongs to the swap, i.e. to both of its cells — show it once,
          // under the second one.
          const showWhy = c.why && i % 2 === 1
          return (
            <li
              key={i}
              style={{ padding: '7px 10px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12.5, lineHeight: 1.6 }}
            >
              <div style={{ color: 'var(--text-2)', fontWeight: 600 }}>
                {dayTitle(c.day)} · {meta?.name ?? c.shift} · {c.role}
              </div>
              <div style={{ color: 'var(--text)' }}>
                <span style={{ textDecoration: 'line-through', color: 'var(--text-3)' }}>{name(c.fromId)}</span>
                {' ← '}
                <strong>{name(c.toId)}</strong>
              </div>
              {showWhy && <div style={{ color: 'var(--text-3)', fontSize: 11.5, marginTop: 2 }}>{c.why}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
