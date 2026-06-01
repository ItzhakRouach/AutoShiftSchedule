'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Avatar } from '@/components/ui/Avatar'
import { candidateStatus } from '@/lib/schedule/candidate-status'
import type { ShiftId } from '@/lib/domain/constants'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import { applyTwelvePair } from './pair-actions'

interface Props {
  day: number | null
  onClose: () => void
  view: ScheduleView
  meta: EditMeta
}

/** Roles required on the given day (any shift), in view order. */
function rolesForDay(view: ScheduleView, day: number): { id: string; name: string }[] {
  const req = view.requirements[day] ?? {}
  const ids = new Set<string>()
  for (const byRole of Object.values(req)) for (const [rid, c] of Object.entries(byRole)) if (c > 0) ids.add(rid)
  return view.roles.filter((r) => ids.has(r.id))
}

export function TwelvePairEditor({ day, onClose, view, meta }: Props) {
  const router = useRouter()
  const [, start] = useTransition()
  const [roleId, setRoleId] = useState<string | null>(null)
  const [morning, setMorning] = useState<string | null>(null)
  const [night, setNight] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (day === null) return null
  const roles = rolesForDay(view, day)
  const empById = new Map(view.employees.map((e) => [e.id, e]))

  function pick(slotKey: ShiftId, chosen: string | null) {
    if (!roleId) return [] as { id: string; name: string; disabled: boolean; label: string; sel: boolean }[]
    return view.employees.map((e) => {
      const em = meta.employees[e.id]
      if (!em) return null
      const c = candidateStatus({ emp: em, day: day!, shiftKey: slotKey, roleId, minRestHours: meta.minRestHours })
      return { id: e.id, name: e.name, disabled: c.disabled, label: c.label, sel: chosen === e.id }
    }).filter(Boolean) as { id: string; name: string; disabled: boolean; label: string; sel: boolean }[]
  }

  function apply() {
    if (!roleId || !morning || !night) return
    setMsg(null); setBusy(true)
    void (async () => {
      try {
        const res = await applyTwelvePair(view.periodId, day!, roleId, morning, night)
        if (!res.ok) { setMsg(res.error ?? 'שגיאה'); return }
        setMsg(res.warning ?? null)
        start(() => router.refresh())
      } finally { setBusy(false) }
    })()
  }

  const roleName = view.roles.find((r) => r.id === roleId)?.name ?? ''
  const list = (slot: ShiftId, chosen: string | null, set: (id: string) => void, tid: string) => (
    <div data-testid={tid} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '24vh', overflowY: 'auto' }}>
      {pick(slot, chosen).map((c) => (
        <button key={c.id} disabled={c.disabled || busy} onClick={() => set(c.id)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 11px',
          borderRadius: 12, border: `1px solid ${c.sel ? 'var(--accent)' : 'var(--border)'}`,
          background: c.sel ? 'var(--accent-soft)' : 'var(--surface)', cursor: c.disabled ? 'default' : 'pointer',
          opacity: c.disabled ? 0.5 : 1, fontFamily: 'var(--font)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={c.name} color={empById.get(c.id)?.color ?? '#888'} size={26} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: c.disabled ? '#EB6A4E' : 'var(--accent)' }}>{c.label}</span>
        </button>
      ))}
    </div>
  )

  return (
    <Sheet open onClose={onClose} title={`צמד 12 שעות · ${view.days[day]?.short ?? ''}`}>
      {msg && <div style={{ padding: '9px 12px', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--text)', fontSize: 13, marginBottom: 12 }}>{msg}</div>}

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '6px 0 8px' }}>בחרו תפקיד</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {roles.map((r) => (
          <button key={r.id} onClick={() => { setRoleId(r.id); setMorning(null); setNight(null); setMsg(null) }} style={{
            padding: '6px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font)', cursor: 'pointer',
            border: `1px solid ${roleId === r.id ? 'var(--accent)' : 'var(--border)'}`,
            background: roleId === r.id ? 'var(--accent-soft)' : 'var(--surface)',
            color: roleId === r.id ? 'var(--accent)' : 'var(--text)',
          }}>{r.name}</button>
        ))}
      </div>

      {roleId && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '6px 0 8px' }}>עובד בוקר (12ש׳ יום · בוקר+צהריים)</div>
          {list('m12_day' as ShiftId, morning, setMorning, 'pair-morning')}
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '14px 0 8px' }}>עובד לילה (12ש׳ לילה)</div>
          {list('m12_night' as ShiftId, night, setNight, 'pair-night')}

          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, margin: '14px 0', padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>
            {morning ? <b>{empById.get(morning)?.name}</b> : '…'} ← יום 12ש׳ (מכסה בוקר+צהריים), {night ? <b>{empById.get(night)?.name}</b> : '…'} ← לילה 12ש׳, ועובד הצהריים של {roleName} יוסר.
          </div>

          <button disabled={!morning || !night || busy} onClick={apply} style={{
            width: '100%', padding: '11px', borderRadius: 14, fontSize: 14, fontWeight: 800, fontFamily: 'var(--font)',
            border: 'none', cursor: !morning || !night || busy ? 'default' : 'pointer',
            background: !morning || !night || busy ? 'var(--border)' : 'var(--accent)',
            color: !morning || !night || busy ? 'var(--text-2)' : '#fff',
          }}>{busy ? 'מחיל…' : 'החל צמד 12 שעות'}</button>
        </>
      )}
    </Sheet>
  )
}
