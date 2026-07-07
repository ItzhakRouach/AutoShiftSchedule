'use client'

import { Avatar } from '@/components/ui/Avatar'

export type CandTone = 'requested' | 'available' | 'override' | 'blocked'

const TONE: Record<CandTone, { color: string; soft: string }> = {
  requested: { color: 'var(--success)', soft: 'var(--success-soft)' },
  available: { color: 'var(--accent)', soft: 'var(--accent-soft)' },
  override: { color: 'var(--warning)', soft: 'var(--warning-soft)' },
  blocked: { color: 'var(--text-3)', soft: 'var(--surface-sunk)' },
}

interface Props {
  name: string
  color: string
  label: string
  tone: CandTone
  disabled: boolean
  onClick?: () => void
}

/** One worker row in the slot-editor candidate list: avatar + name + a status
 *  pill. Split out of CandidateList to keep that file within the ≤200 budget. */
export function CandidateRow({ name, color, label, tone, disabled, onClick }: Props) {
  const t = TONE[tone]
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        width: '100%', padding: '8px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
        background: 'var(--surface)', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1, fontFamily: 'var(--font)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={name} color={color} size={26} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: t.color, background: t.soft, padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
        {label}
      </span>
    </button>
  )
}
