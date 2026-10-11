'use client'

import React from 'react'
import { Icon, type IconName } from './Icon'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import type { ShiftDisplay } from '@/lib/domain/meta'

interface ShiftDotProps {
  /** Shift key — a known ShiftId, or a workplace's own custom shift key. */
  shift: string
  /**
   * The workplace's DB-driven display row, when the caller has one. The week
   * table deliberately prefers these over the seeded constants (see
   * WeekTableBody), so a renamed or recoloured shift still renders correctly.
   */
  meta?: ShiftDisplay
  size?: number
  /** Render greyed out — e.g. a shift the worker is not available for. */
  inactive?: boolean
}

/**
 * The shift glyph: one square carrying a shift's own colour and icon, so a
 * shift looks identical everywhere it appears (table, drawer, request chips,
 * day grid, slot editor).
 *
 * Ported from DesignTemplate/ui.jsx:133-145 — it has been listed in
 * docs/design-system.md since the start but was never built, which is why each
 * surface renders shifts differently today.
 *
 * `ShiftDisplay` carries no icon (only name/time/colour), so the icon resolves
 * from SHIFT_META by key and falls back to a clock for custom shifts.
 */
export function ShiftDot({ shift, meta, size = 30, inactive = false }: ShiftDotProps) {
  const seeded = SHIFT_META[shift as ShiftId]
  const icon: IconName = (seeded?.icon as IconName) ?? 'clock'
  const color = inactive ? 'var(--text-3)' : (meta?.color ?? seeded?.color ?? 'var(--text-2)')
  const background = inactive ? 'var(--surface-sunk)' : (meta?.soft ?? seeded?.soft ?? 'var(--surface-sunk)')

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--r-sm)',
        flexShrink: 0,
        background,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.58)} stroke={2} />
    </div>
  )
}
