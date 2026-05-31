'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Segmented } from '@/components/ui/Segmented'
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

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('scope', value)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return <Segmented options={OPTIONS} value={scope} onChange={handleChange} />
}
