'use client'

import React from 'react'
import { Icon } from '@/components/ui/Icon'
import { DIST_BUCKETS, type EmpDistributionRow } from '@/lib/schedule/emp-distribution'
import type { ShiftDisplay } from '@/lib/domain/meta'

export interface RowFlags {
  belowMin: boolean
  overMax: boolean
  minShifts: number | null
  maxShifts: number | null
}

/**
 * One worker's week as a single stacked bar, segmented by shift type.
 *
 * Every row shares one denominator (the busiest worker), so the bars are
 * directly comparable down the column — the point is that you can see who is
 * carrying more without reading a number. The flag chip is the only thing that
 * interrupts; everything else stays quiet.
 */
export function DistributionRow({
  row, maxTotal, flags, metaFor, expanded, onToggle,
}: {
  row: EmpDistributionRow
  maxTotal: number
  flags: RowFlags
  metaFor: (bucket: string) => ShiftDisplay
  expanded: boolean
  onToggle: () => void
}) {
  const pct = (row.total / maxTotal) * 100
  const flag = flags.belowMin
    ? { text: `מתחת למינימום ${flags.minShifts}`, color: 'var(--warning)', soft: 'var(--warning-soft)' }
    : flags.overMax
      ? { text: `חריגה ממקסימום ${flags.maxShifts}`, color: 'var(--danger)', soft: 'var(--danger-soft)' }
      : null

  return (
    <button
      type="button"
      data-testid="distribution-row"
      onClick={onToggle}
      aria-expanded={expanded}
      style={{
        display: 'block', width: '100%', textAlign: 'start',
        padding: 'var(--space-3) var(--space-3)',
        borderRadius: 'var(--r-md)',
        border: '1px solid transparent',
        background: expanded ? 'var(--surface-2)' : 'transparent',
        cursor: 'pointer', font: 'inherit', color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: row.color, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name}
        </span>
        {flag && (
          <span style={{ flexShrink: 0, fontSize: 'var(--text-xs)', fontWeight: 700, color: flag.color, background: flag.soft, borderRadius: 'var(--r-pill)', padding: '2px 8px' }}>
            {flag.text}
          </span>
        )}
        <span className="tabular" style={{ flexShrink: 0, fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text)' }}>
          {row.total}
        </span>
        <span className="tabular" style={{ flexShrink: 0, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-3)', minWidth: 38, textAlign: 'end' }}>
          {row.hours}ש׳
        </span>
        <Icon name={expanded ? 'minus' : 'plus'} size={14} stroke={2.2} color="var(--text-3)" />
      </div>

      {/* The stacked bar. Empty weeks render the track alone. */}
      <div
        style={{
          display: 'flex', gap: 2, marginTop: 7, height: 10,
          borderRadius: 99, background: 'var(--surface-sunk)', overflow: 'hidden',
          width: `${Math.max(pct, row.total > 0 ? 6 : 100)}%`,
        }}
      >
        {row.total > 0 &&
          DIST_BUCKETS.filter((b) => row.counts[b] > 0).map((b) => (
            <div
              key={b}
              title={`${metaFor(b).name}: ${row.counts[b]}`}
              style={{ flex: row.counts[b], background: metaFor(b).color }}
            />
          ))}
      </div>
    </button>
  )
}
