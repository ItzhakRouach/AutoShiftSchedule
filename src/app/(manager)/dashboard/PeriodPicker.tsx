'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import type { PeriodOption } from '@/lib/stats/period-options'

/** Dropdown of the active scope's published periods (weeks / months / years).
 *  Selecting one sets the `at=` anchor; the empty value means the scope's
 *  default period (latest published week / current month / current year). */
export function PeriodPicker({ options, at }: { options: PeriodOption[]; at: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  // Optimistic selection, same pattern as ScopeToggle: show the tapped period
  // immediately while the server re-renders.
  const [picked, setPicked] = useState<string | null>(null)

  if (options.length === 0) return null

  function handleChange(value: string) {
    setPicked(value)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set('at', value)
      else params.delete('at')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  const shown = isPending && picked !== null ? picked : (at ?? '')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select
        value={shown}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="בחירת תקופה"
        style={{
          fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700,
          color: 'var(--text)', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          padding: '6px 10px', cursor: 'pointer',
        }}
      >
        <option value="">נוכחי</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {isPending && <Spinner size={14} delayed color="var(--accent)" aria-label="טוען נתונים" />}
    </div>
  )
}
