'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Btn } from '@/components/ui/Btn'
import { clearSchedule } from './lifecycle-actions'

/**
 * Danger control: wipes ALL assignments for the period so the manager can
 * generate a fresh schedule. Two-step confirm to avoid accidental loss.
 */
export function DeleteScheduleButton({ periodId, onDone }: { periodId: string; onDone?: () => void }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run() {
    setError(null)
    start(async () => {
      const res = await clearSchedule(periodId)
      if (!res.ok) { setError(res.error ?? 'שגיאה'); return }
      setConfirm(false)
      onDone?.()
      router.refresh()
    })
  }

  if (!confirm) {
    return (
      <>
        <div style={{ height: 10 }} />
        <Btn variant="danger" size="md" icon="x" style={{ width: '100%' }} onClick={() => setConfirm(true)}>
          מחיקת הסידור
        </Btn>
      </>
    )
  }

  return (
    <div style={{ marginTop: 10, padding: 14, borderRadius: 'var(--r-md)', border: '1.5px solid rgba(220,70,70,0.4)', background: 'rgba(220,70,70,0.06)' }}>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)', textAlign: 'center' }}>
        למחוק את כל השיבוצים? אפשר ליצור סידור חדש לאחר מכן.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" size="sm" style={{ flex: 1 }} disabled={busy} onClick={() => setConfirm(false)}>ביטול</Btn>
        <Btn variant="danger" size="sm" style={{ flex: 1 }} disabled={busy} onClick={run}>
          {busy ? 'מוחק…' : 'מחק'}
        </Btn>
      </div>
      {error && <p style={{ fontSize: 12.5, color: '#D8423B', marginTop: 8, textAlign: 'center' }}>{error}</p>}
    </div>
  )
}
