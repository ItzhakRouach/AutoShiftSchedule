'use client'

import React from 'react'
import { ShiftDot } from '@/components/ui/ShiftDot'
import { DIST_BUCKETS, type EmpDistributionRow } from '@/lib/schedule/emp-distribution'
import type { ShiftDisplay } from '@/lib/domain/meta'
import type { ScheduleView } from '@/lib/schedule/view-data'

/**
 * The expanded worker: the five bucket counts, then the week day by day.
 * Reads row.byDay, which the helper already built, so there is no second pass
 * over the schedule here.
 */
export function DistributionDetail({
  row, days, metaFor,
}: {
  row: EmpDistributionRow
  days: ScheduleView['days']
  metaFor: (bucket: string) => ShiftDisplay
}) {
  const worked = DIST_BUCKETS.filter((b) => row.counts[b] > 0)

  return (
    <div style={{ padding: '0 var(--space-3) var(--space-3)' }}>
      {worked.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
          לא שובץ השבוע.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            {worked.map((b) => (
              <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ShiftDot shift={b} meta={metaFor(b)} size={22} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', fontWeight: 600 }}>
                  {metaFor(b).name}
                </span>
                <span className="tabular" style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text)' }}>
                  {row.counts[b]}
                </span>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {days.map((d) => {
              const buckets = row.byDay[d.index] ?? []
              return (
                <div
                  key={d.index}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: '4px 0',
                    opacity: buckets.length === 0 ? 0.45 : 1,
                  }}
                >
                  <span style={{ width: 26, flexShrink: 0, fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-3)' }}>
                    {d.short}
                  </span>
                  {buckets.length === 0 ? (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>—</span>
                  ) : (
                    buckets.map((b, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <ShiftDot shift={b} meta={metaFor(b)} size={20} />
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-2)' }}>
                          {metaFor(b).name}
                        </span>
                      </span>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
