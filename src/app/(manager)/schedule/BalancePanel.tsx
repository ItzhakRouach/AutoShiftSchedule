'use client'

import React, { useMemo, useState } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { buildEmpBalance, sortBalanceRows, type BalanceSort } from '@/lib/schedule/emp-balance'
import { shiftMetaFromRow } from '@/lib/domain/meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import { BalanceRow, BALANCE_COLS, type BalanceFlag } from './BalanceRow'

const SORTS = [
  { value: 'total', label: 'לפי משמרות' },
  { value: 'nights', label: 'לפי לילות' },
  { value: 'requests', label: 'לפי בקשות' },
]

const headCell: React.CSSProperties = { textAlign: 'center' }

/**
 * "מאזן עובדים" — the live side panel beside the week table. Everything is
 * derived from `view`, which the server re-sends after each edit, so the
 * numbers follow every assignment with no extra request.
 */
export function BalancePanel({
  view, editMeta, selectedId, onSelect,
}: {
  view: ScheduleView
  editMeta: EditMeta | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const [sort, setSort] = useState<BalanceSort>('total')
  const balance = useMemo(() => buildEmpBalance(view), [view])
  const rows = useMemo(() => sortBalanceRows(balance, sort), [balance, sort])

  const shiftColors = useMemo(() => {
    const color = (key: string) => (view.shiftMeta?.[key] ?? shiftMetaFromRow({ key })).color
    return { morning: color('morning'), noon: color('noon'), night: color('night') }
  }, [view.shiftMeta])

  const flagFor = (employeeId: string, total: number): BalanceFlag | null => {
    const m = editMeta?.employees[employeeId]
    if (m?.minShifts != null && total < m.minShifts) {
      return { text: `מתחת למינימום ${m.minShifts}`, color: 'var(--warning)', soft: 'var(--warning-soft)' }
    }
    if (m?.maxShifts != null && total > m.maxShifts) {
      return { text: `חריגה ממקסימום ${m.maxShifts}`, color: 'var(--danger)', soft: 'var(--danger-soft)' }
    }
    return null
  }

  const sumTotal = balance.reduce((s, r) => s + r.total, 0)
  const sumAsked = balance.reduce((s, r) => s + r.asked, 0)
  const sumGot = balance.reduce((s, r) => s + r.got, 0)
  const avg = balance.length > 0 ? (sumTotal / balance.length).toFixed(1) : '0'

  return (
    <aside
      aria-label="מאזן עובדים"
      data-testid="balance-panel"
      style={{
        direction: 'rtl', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
        padding: 'var(--space-4)', borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)', background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-h2)', fontWeight: 800, color: 'var(--text)' }}>מאזן עובדים</h2>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>מתעדכן עם כל שיבוץ</span>
      </div>

      <Segmented options={SORTS} value={sort} onChange={(v) => setSort(v as BalanceSort)} />

      <div style={{ display: 'grid', gridTemplateColumns: BALANCE_COLS, gap: 6, alignItems: 'center', padding: '0 10px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-2)' }}>
        <span>עובד</span>
        <span style={headCell}>בוקר</span>
        <span style={headCell}>צהר׳</span>
        <span style={headCell}>לילה</span>
        <span style={headCell} title="משמרות 12 שעות">12ש׳</span>
        <span style={headCell}>סה״כ</span>
        <span style={headCell}>בקשות</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((row) => (
          <BalanceRow
            key={row.employeeId}
            row={row}
            roles={view.roles}
            shiftColors={shiftColors}
            flag={flagFor(row.employeeId, row.total)}
            selected={selectedId === row.employeeId}
            onToggle={() => onSelect(selectedId === row.employeeId ? null : row.employeeId)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border)', fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
        <span>ממוצע <strong className="tabular" style={{ color: 'var(--text)' }}>{avg}</strong> משמרות לעובד</span>
        <span data-testid="balance-requests-total">
          בקשות שכובדו <strong className="tabular" style={{ color: 'var(--text)' }}>{sumGot} מתוך {sumAsked}</strong>
        </span>
      </div>
    </aside>
  )
}
