'use client'

import { useState } from 'react'
import { Btn } from '@/components/ui/Btn'

interface Props {
  periodId: string
  weekLabel: string
}

export function ShareButton({ periodId, weekLabel }: Props) {
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const imageUrl = `/api/schedule-image/${periodId}`

  async function handleShare() {
    setHint(null)
    setLoading(true)
    try {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error(`שגיאה בטעינת התמונה (${res.status})`)
      const blob = await res.blob()
      const file = new File([blob], 'schedule.png', { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `סידור שבועי · ${weekLabel}`,
          text: `סידור עבודה לשבוע ${weekLabel}`,
        })
      } else {
        // Fallback: trigger download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'schedule.png'
        a.click()
        URL.revokeObjectURL(url)
        setHint('התמונה הורדה — שתפו אותה בקבוצת הוואטסאפ')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return // user cancelled
      const msg = err instanceof Error ? err.message : 'שגיאה בשיתוף'
      setHint(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn
          variant="soft"
          size="md"
          style={{ flex: 1 }}
          disabled={loading}
          onClick={handleShare}
        >
          {loading ? 'טוען…' : 'שתף לקבוצה'}
        </Btn>
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 14px',
            borderRadius: 'var(--r-md)',
            border: '1.5px solid var(--border)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-2)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          תצוגה מקדימה
        </a>
      </div>
      {hint && (
        <div
          style={{
            fontSize: 13,
            color: hint.startsWith('שגיאה') || hint.startsWith('שגיאה') ? '#EB6A4E' : 'var(--text-2)',
            fontWeight: 600,
            padding: '8px 12px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(0,0,0,0.04)',
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}
