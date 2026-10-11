'use client'

import React, { useMemo, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Segmented } from '@/components/ui/Segmented'
import { ShiftDot } from '@/components/ui/ShiftDot'
import { buildEmpDistribution, DIST_BUCKETS } from '@/lib/schedule/emp-distribution'
import { shiftMetaFromRow } from '@/lib/domain/meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import { DistributionRow, type RowFlags } from './DistributionRow'
import { DistributionDetail } from './DistributionDetail'

type SortMode = 'total' | 'nights' | 'name'

const SORTS = [
  { value: 'total', label: 'לפי משמרות' },
  { value: 'nights', label: 'לפי לילות' },
  { value: 'name', label: 'לפי שם' },
]

/**
 * "Is this week fair?" — every worker on one scale, so an outlier shows up
 * without reading a single number.
 *
 * Sorting is the mechanism, not decoration: ordering by total (or by nights)
 * puts the extremes adjacent, which is what makes a glance work. `editMeta` is
 * null on the published read-only view, so the min/max flags simply disappear
 * there, the same way EmpTotalsBar already behaves.
 */
export function DistributionDrawer({
  open, onClose, view, editMeta,
}: {
  open: boolean
  onClose: () => void
  view: ScheduleView
  editMeta: EditMeta | null
}) {
  const [sort, setSort] = useState<SortMode>('total')
  const [openId, setOpenId] = useState<string | null>(null)

  const dist = useMemo(() => buildEmpDistribution(view), [view])
  // Resolved up front for all five buckets — the workplace's own shift row when
  // it has one, else the seeded constants, exactly as the week table resolves
  // them (WeekTableBody). A lazily-filled cache would mutate after render.
  const metaFor = useMemo(() => {
    const table = Object.fromEntries(
      DIST_BUCKETS.map((b) => [b, view.shiftMeta?.[b] ?? shiftMetaFromRow({ key: b })]),
    )
    return (bucket: string) => table[bucket] ?? shiftMetaFromRow({ key: bucket })
  }, [view.shiftMeta])

  const rows = useMemo(() => {
    const copy = [...dist.rows]
    if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name, 'he'))
    if (sort === 'nights') {
      return copy.sort(
        (a, b) =>
          b.counts.night + b.counts.m12_night - (a.counts.night + a.counts.m12_night) ||
          b.total - a.total,
      )
    }
    return copy.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'he'))
  }, [dist.rows, sort])

  const flagsFor = (employeeId: string, total: number): RowFlags => {
    const m = editMeta?.employees[employeeId]
    return {
      minShifts: m?.minShifts ?? null,
      maxShifts: m?.maxShifts ?? null,
      belowMin: m?.minShifts != null && total < m.minShifts,
      overMax: m?.maxShifts != null && total > m.maxShifts,
    }
  }

  const staffed = dist.rows.filter((r) => r.total > 0).length

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="חלוקת משמרות"
      subtitle={`${staffed} מתוך ${dist.rows.length} עובדים שובצו · ממוצע ${dist.avgTotal.toFixed(1)} משמרות`}
      testId="distribution-drawer"
    >
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <Segmented options={SORTS} value={sort} onChange={(v) => setSort(v as SortMode)} />
      </div>

      {/* Legend: the same glyph and colour the bars and the table use. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border)' }}>
        {DIST_BUCKETS.filter((b) => dist.bucketTotals[b] > 0).map((b) => (
          <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShiftDot shift={b} meta={metaFor(b)} size={20} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', fontWeight: 600 }}>{metaFor(b).name}</span>
            <span className="tabular" style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text)' }}>
              {dist.bucketTotals[b]}
            </span>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((row) => (
          <div key={row.employeeId}>
            <DistributionRow
              row={row}
              maxTotal={dist.maxTotal}
              flags={flagsFor(row.employeeId, row.total)}
              metaFor={metaFor}
              expanded={openId === row.employeeId}
              onToggle={() => setOpenId(openId === row.employeeId ? null : row.employeeId)}
            />
            {openId === row.employeeId && (
              <DistributionDetail row={row} days={view.days} metaFor={metaFor} />
            )}
          </div>
        ))}
      </div>
    </Drawer>
  )
}
