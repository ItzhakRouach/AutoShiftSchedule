'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import type { Scope } from '@/lib/stats/types'

const OPTIONS = [
  { value: 'week', label: 'שבוע' },
  { value: 'month', label: 'חודש' },
  { value: 'year', label: 'שנה' },
]

export function ScopeToggle({ scope }: { scope: Scope }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  // Optimistic selection: highlight the tapped scope immediately while the
  // server re-renders the dashboard, instead of freezing on the old one.
  const [picked, setPicked] = useState<Scope | null>(null)

  function handleChange(value: string) {
    setPicked(value as Scope)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('scope', value)
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  const shown = isPending && picked ? picked : scope

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <Segmented options={OPTIONS} value={shown} onChange={handleChange} />
      </div>
      {isPending && <Spinner size={16} delayed color="var(--accent)" aria-label="טוען נתונים" />}
    </div>
  )
}
