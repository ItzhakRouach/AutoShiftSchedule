'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { Coverage, TwelveHourSuggestion, OverriddenOff, Warning } from '@/lib/scheduling/types'
import { runSchedule, publishSchedule, hasManualAssignments } from './actions'

/** Generate / publish orchestration + the state it drives. Split out of
 *  ScheduleClient to keep that component a thin view (≤200 lines). */
export function useScheduleActions(view: ScheduleView) {
  const router = useRouter()
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [suggestions, setSuggestions] = useState<TwelveHourSuggestion[]>([])
  const [overriddenOff, setOverriddenOff] = useState<OverriddenOff[]>([])
  const [uncovered, setUncovered] = useState<Warning[]>([])
  const [showIssues, setShowIssues] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [published, setPublished] = useState(view.status === 'published')
  const [showConfirm, setShowConfirm] = useState(false)
  const [running, startRun] = useTransition()
  const [publishing, startPublish] = useTransition()
  // Pre-generate check (server round-trip) — give the button instant feedback.
  const [checking, startCheck] = useTransition()

  const hasResult = view.hasAssignments || coverage !== null

  function triggerGenerate(replaceManual: boolean) {
    setShowConfirm(false)
    setError(null)
    startRun(async () => {
      const res = await runSchedule(view.periodId, { replaceManual })
      if (!res.ok) { setError(res.error ?? 'שגיאה'); return }
      setCoverage(res.coverage ?? null)
      setSuggestions(res.twelveHourSuggestions ?? [])
      const ov = res.overriddenOff ?? []
      const un = res.uncovered ?? []
      setOverriddenOff(ov)
      setUncovered(un)
      setShowIssues(ov.length > 0 || un.length > 0)
      router.refresh()
    })
  }

  function handleGenerateClick() {
    startCheck(async () => {
      const manual = view.hasAssignments ? await hasManualAssignments(view.periodId) : false
      if (manual) { setShowConfirm(true) } else { triggerGenerate(false) }
    })
  }

  function publish() {
    setError(null)
    startPublish(async () => {
      const res = await publishSchedule(view.periodId)
      if (!res.ok) { setError(res.error ?? 'שגיאה'); return }
      setPublished(true)
      router.refresh()
    })
  }

  /** Reset after a full schedule delete. */
  function resetAfterDelete() {
    setPublished(false)
    setCoverage(null)
    setSuggestions([])
  }

  return {
    coverage, suggestions, overriddenOff, uncovered, showIssues, setShowIssues,
    error, published, setPublished, publishing, checking, running, hasResult,
    showConfirm, setShowConfirm,
    triggerGenerate, handleGenerateClick, publish, resetAfterDelete,
  }
}
