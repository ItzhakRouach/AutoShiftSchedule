'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { Coverage, TwelveHourSuggestion } from '@/lib/scheduling/types'
import { runSchedule, publishSchedule, hasManualAssignments } from './actions'
import { FeasibilityBanner } from './FeasibilityBanner'
import { WeekTable } from './WeekTable'
import { SwapEditor, type SlotCtx } from './SwapEditor'
import { TwelveHourList, Generating } from './parts'
import { RegenerateConfirm } from './RegenerateConfirm'
import { ShareButton } from './ShareButton'

interface Props {
  view: ScheduleView
  editMeta: EditMeta | null
}

export function ScheduleClient({ view, editMeta }: Props) {
  const router = useRouter()
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [suggestions, setSuggestions] = useState<TwelveHourSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [published, setPublished] = useState(view.status === 'published')
  const [slot, setSlot] = useState<SlotCtx | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [running, startRun] = useTransition()
  const [publishing, startPublish] = useTransition()

  const hasResult = view.hasAssignments || coverage !== null

  async function triggerGenerate(replaceManual: boolean) {
    setShowConfirm(false)
    setError(null)
    startRun(async () => {
      const res = await runSchedule(view.periodId, { replaceManual })
      if (!res.ok) { setError(res.error ?? 'שגיאה'); return }
      setCoverage(res.coverage ?? null)
      setSuggestions(res.twelveHourSuggestions ?? [])
      router.refresh()
    })
  }

  async function handleGenerateClick() {
    const manual = view.hasAssignments ? await hasManualAssignments(view.periodId) : false
    if (manual) { setShowConfirm(true) } else { await triggerGenerate(false) }
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

  if (running) return <Generating />

  const pct = coverage ? coverage.percent : null

  return (
    <div>
      {showConfirm && (
        <RegenerateConfirm
          busy={running}
          onKeep={() => triggerGenerate(false)}
          onReplace={() => triggerGenerate(true)}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>שיבוץ אוטומטי</h1>
        {pct !== null && (
          <div style={{ textAlign: 'center', background: pct >= 95 ? 'rgba(19,169,142,0.12)' : 'rgba(235,106,78,0.12)', borderRadius: 'var(--r-md)', padding: '8px 13px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: pct >= 95 ? '#13A98E' : '#EB6A4E', lineHeight: 1 }} data-testid="coverage">
              {pct}%
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>כיסוי</div>
          </div>
        )}
      </div>

      <FeasibilityBanner feasibility={view.feasibility} />

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'rgba(235,106,78,0.1)', color: '#EB6A4E', fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!hasResult && (
        <Card style={{ textAlign: 'center', padding: '24px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>בונים את הסידור עבורכם</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
            המערכת תשבץ את העובדים לפי הבקשות, התפקידים הנדרשים וזמני המנוחה.
          </div>
        </Card>
      )}

      <Btn variant="primary" size="lg" icon="check" style={{ width: '100%' }} onClick={handleGenerateClick}>
        צור סידור אוטומטי
      </Btn>

      {hasResult && (
        <>
          <div style={{ height: 14 }} />
          <WeekTable view={view} onSlot={editMeta ? setSlot : undefined} />
          <TwelveHourList suggestions={suggestions} roles={view.roles} />
          <div style={{ height: 14 }} />
          <Btn variant={published ? 'soft' : 'primary'} size="md" icon="check" style={{ width: '100%' }} disabled={publishing} onClick={publish}>
            {published ? 'פורסם ✓' : publishing ? 'מפרסם…' : 'פרסם סידור'}
          </Btn>
          {published && (
            <>
              <div style={{ height: 10 }} />
              <ShareButton periodId={view.periodId} weekLabel={view.days[0]?.date ?? ''} />
            </>
          )}
        </>
      )}

      {editMeta && (
        <SwapEditor slot={slot} onClose={() => setSlot(null)} view={view} meta={editMeta} />
      )}
    </div>
  )
}
