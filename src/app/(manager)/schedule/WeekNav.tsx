'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import type { PublishedWeek } from '@/lib/schedule/published-view'

/**
 * Previous/next navigator across PUBLISHED weeks. `weeks` is newest-first.
 * Sets ?w=<periodId> on the current path; clearing it (latest) drops the param.
 * Shared by the worker schedule and the manager's read-only history view.
 */
export function WeekNav({ weeks, selectedId }: { weeks: PublishedWeek[]; selectedId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  if (weeks.length <= 1) {
    const only = weeks.find((w) => w.id === selectedId)
    return only ? (
      <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12 }}>
        שבוע {only.label}
      </div>
    ) : null
  }

  const i = Math.max(0, weeks.findIndex((w) => w.id === selectedId))
  const newer = weeks[i - 1] // more recent
  const older = weeks[i + 1] // previous week
  const cur = weeks[i]

  const go = (id: string | undefined) => {
    if (!id) return
    router.push(`${pathname}?w=${id}`)
  }

  // Calendar: pick any date → jump to the published week that contains it.
  const weekEnd = (start: string) => {
    const d = new Date(start + 'T00:00:00')
    d.setDate(d.getDate() + 6)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const sorted = [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  const minDate = sorted[0]?.weekStart
  const maxDate = sorted.length ? weekEnd(sorted[sorted.length - 1].weekStart) : undefined
  const onPick = (val: string) => {
    if (!val) return
    const hit = weeks.find((w) => val >= w.weekStart && val <= weekEnd(w.weekStart))
    if (hit) go(hit.id)
  }

  const btn = (enabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: enabled ? 'var(--text)' : 'var(--text-3)', cursor: enabled ? 'pointer' : 'default',
    fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', opacity: enabled ? 1 : 0.5,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* RTL: previous (older) week on the right, newer on the left */}
        <button type="button" style={btn(!!older)} disabled={!older} onClick={() => go(older?.id)} aria-label="שבוע קודם">
          <Icon name="chevronRight" size={16} /> שבוע קודם
        </button>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', textAlign: 'center', flex: 1, minWidth: 0 }}>
          שבוע {cur?.label ?? ''}
        </div>
        <button type="button" style={btn(!!newer)} disabled={!newer} onClick={() => go(newer?.id)} aria-label="שבוע הבא">
          שבוע הבא <Icon name="chevronLeft" size={16} />
        </button>
      </div>
      {/* Calendar: jump to the published week containing the chosen date. */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)' }}>
        <Icon name="calendar" size={15} color="var(--text-2)" />
        בחירת שבוע מהיומן:
        <input
          type="date"
          min={minDate}
          max={maxDate}
          value={cur?.weekStart ?? ''}
          onChange={(e) => onPick(e.target.value)}
          aria-label="בחר שבוע לפי תאריך"
          style={{
            padding: '6px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)',
          }}
        />
      </label>
    </div>
  )
}
