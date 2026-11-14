'use client'

import React from 'react'
import type { EmpBalanceRow } from '@/lib/schedule/emp-balance'
import type { ViewRole } from '@/lib/schedule/view-data'

/** Shared column template for the header and every row, so they stay aligned. */
export const BALANCE_COLS = 'minmax(0, 1fr) 32px 32px 32px 32px 36px 68px'

export interface BalanceFlag {
  text: string
  color: string
  soft: string
}

const countCell = (bg: string): React.CSSProperties => ({
  textAlign: 'center', fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)',
  background: bg, borderRadius: 8, padding: '3px 0',
})

/**
 * One worker in the balance panel: shift-type counts on the first line, then
 * role counts, hours and any min/max flag. Clicking selects the worker, which
 * highlights their cells in the week table.
 */
export function BalanceRow({
  row, roles, shiftColors, flag, selected, onToggle,
}: {
  row: EmpBalanceRow
  roles: ViewRole[]
  shiftColors: { morning: string; noon: string; night: string }
  flag: BalanceFlag | null
  selected: boolean
  onToggle: () => void
}) {
  const pct = row.asked > 0 ? Math.round((row.got / row.asked) * 100) : 0
  const worked = roles.filter((r) => (row.roleCounts[r.id] ?? 0) > 0)

  return (
    <button
      type="button"
      data-testid="balance-row"
      aria-pressed={selected}
      onClick={onToggle}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6, width: '100%', textAlign: 'start',
        padding: 'var(--space-2)', borderRadius: 'var(--r-sm)', cursor: 'pointer', font: 'inherit', color: 'inherit',
        border: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        background: selected ? 'var(--accent-soft)' : 'transparent',
      }}
    >
      <span style={{ display: 'grid', gridTemplateColumns: BALANCE_COLS, gap: 6, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: row.color, flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
        </span>
        <span data-testid="balance-morning" className="tabular" style={countCell(`${shiftColors.morning}33`)}>{row.counts.morning}</span>
        <span data-testid="balance-noon" className="tabular" style={countCell(`${shiftColors.noon}33`)}>{row.counts.noon}</span>
        {/* A 19:00–07:00 shift is a night like any other; the 12h column is the 07:00–19:00 day shift. */}
        <span data-testid="balance-night" className="tabular" style={countCell(`${shiftColors.night}33`)}>{row.counts.night + row.counts.m12_night}</span>
        <span data-testid="balance-twelve" className="tabular" style={countCell('var(--warning-soft)')}>{row.counts.m12_day}</span>
        <span data-testid="balance-total" className="tabular" style={{ textAlign: 'center', fontSize: 'var(--text-h3)', fontWeight: 800, color: 'var(--text)' }}>{row.total}</span>
        <span data-testid="balance-requests" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="tabular" style={{ textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 700, color: row.asked > 0 ? 'var(--text)' : 'var(--text-3)' }}>
            {row.asked > 0 ? `${row.got} מתוך ${row.asked}` : 'לא ביקש'}
          </span>
          {row.asked > 0 && (
            <span style={{ display: 'flex', height: 5, borderRadius: 99, background: 'var(--surface-sunk)', overflow: 'hidden' }}>
              <span style={{ width: `${pct}%`, background: 'var(--success)', borderRadius: 99 }} />
            </span>
          )}
        </span>
      </span>

      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>
        {worked.map((r) => (
          <span key={r.id} data-testid="balance-role" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 'var(--r-pill)', padding: '2px 8px' }}>
            {r.name} {row.roleCounts[r.id]}
          </span>
        ))}
        <span className="tabular">{row.hours} שעות</span>
        {row.twelve > 0 && <span className="tabular">מתוכן 12 שעות: {row.twelve}</span>}
        {flag && (
          <span style={{ fontWeight: 700, color: flag.color, background: flag.soft, borderRadius: 'var(--r-pill)', padding: '2px 8px' }}>{flag.text}</span>
        )}
      </span>
    </button>
  )
}
