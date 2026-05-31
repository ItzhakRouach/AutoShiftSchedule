import React from 'react'
import { ROLE_META } from '@/lib/domain/constants'

interface RoleChipProps {
  /** The role name as stored in the DB (e.g. 'אחמ״ש') */
  roleName: string
  /** Color + soft background override — used when the role isn't in ROLE_META */
  color?: string
  soft?: string
  size?: 'sm' | 'md'
  selected?: boolean
  faded?: boolean
  onClick?: () => void
}

export function RoleChip({ roleName, color, soft, size = 'md', selected, faded, onClick }: RoleChipProps) {
  // Try to look up from ROLE_META; fall back to the passed-in color
  const meta = ROLE_META[roleName as keyof typeof ROLE_META]
  const chipColor = color ?? meta?.color ?? '#888'
  const chipSoft = soft ?? meta?.soft ?? 'rgba(136,136,136,0.14)'
  const shortLabel = meta?.short ?? roleName

  const s = size === 'sm' ? { fs: 12, pad: '3px 9px' } : { fs: 13, pad: '5px 11px' }

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: s.pad,
        fontSize: s.fs,
        fontWeight: 600,
        borderRadius: 'var(--r-pill)',
        background: selected === false ? 'transparent' : chipSoft,
        color: faded ? 'var(--text-3)' : chipColor,
        border: `1px solid ${selected === false ? 'var(--border)' : 'transparent'}`,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        opacity: faded ? 0.5 : 1,
        transition: 'all .12s ease',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 99,
          background: faded ? 'var(--text-3)' : chipColor,
        }}
      />
      {shortLabel}
    </span>
  )
}
