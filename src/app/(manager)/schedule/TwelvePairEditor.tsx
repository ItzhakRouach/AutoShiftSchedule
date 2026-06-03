'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Avatar } from '@/components/ui/Avatar'
import type { ShiftId } from '@/lib/domain/constants'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import { expandRolesByRank } from '@/lib/schedule/role-rank'
import { applyTwelvePair, cancelTwelvePair } from './pair-actions'

interface Props {
  day: number | null
  onClose: () => void
  view: ScheduleView
  meta: EditMeta
}

/** True if the employee can fill `roleId` — their held roles, expanded by rank. */
function canFillRole(view: ScheduleView, meta: EditMeta, empId: string, roleId: string): boolean {
  const m = meta.employees[empId]
  if (!m) return false
  return expandRolesByRank(m.roleIds, view.roles).includes(roleId)
}

/** Everyone assigned to a base shift that day (any role). */
function assigneesAt(view: ScheduleView, day: number, shift: 'morning' | 'night'): string[] {
  const byRole = view.grid[day]?.[shift] ?? {}
  const ids: string[] = []
  for (const list of Object.values(byRole)) for (const id of list) ids.push(id)
  return ids
}

/**
 * Roles for which a 12h pair can be formed on this day: a role R is offered when
 * someone on בוקר AND someone on לילה can FILL R (held roles expanded by rank) —
 * so e.g. a night מוקדן who also holds אחמ״ש counts toward an אחמ״ש pair.
 */
function rolesForDay(view: ScheduleView, day: number, meta: EditMeta): { id: string; name: string }[] {
  return view.roles.filter((r) => {
    const m = assigneesAt(view, day, 'morning').some((id) => canFillRole(view, meta, id, r.id))
    const n = assigneesAt(view, day, 'night').some((id) => canFillRole(view, meta, id, r.id))
    return m && n
  })
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
  const roles = rolesForDay(view, day, meta)
  const empById = new Map(view.employees.map((e) => [e.id, e]))
  const roleNameById = new Map(view.roles.map((r) => [r.id, r.name]))
  const existing12h = roleId ? view.twelve.filter((t) => t.day === day && t.roleId === roleId) : []

  function pick(slotKey: ShiftId, chosen: string | null) {
    type Cand = { id: string; name: string; disabled: boolean; label: string; sel: boolean }
    if (!roleId) return [] as Cand[]
    // Offer everyone on that base shift (any role) who can FILL the chosen role —
    // a higher/equal-rank holder qualifies (e.g. an אחמ״ש covers a מוקדן pair).
    // The label shows their CURRENT role at that shift. The server re-validates.
    const baseShift = slotKey === ('m12_day' as ShiftId) ? 'morning' : 'night'
    const byRole = view.grid[day!]?.[baseShift] ?? {}
    const out: Cand[] = []
    for (const [assignedRoleId, ids] of Object.entries(byRole)) {
      for (const id of ids) {
        if (!canFillRole(view, meta, id, roleId)) continue
        const e = empById.get(id)
        if (!e) continue
        out.push({ id, name: e.name, disabled: false, label: roleNameById.get(assignedRoleId) ?? '', sel: chosen === id })
      }
    }
    return out
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

  function cancel() {
    if (!roleId) return
    setMsg(null); setBusy(true)
    void (async () => {
      try {
        const res = await cancelTwelvePair(view.periodId, day!, roleId)
        if (!res.ok) { setMsg(res.error ?? 'שגיאה'); return }
        setMsg(res.warning ?? null)
        setMorning(null); setNight(null)
        start(() => router.refresh())
      } finally { setBusy(false) }
    })()
  }

  const roleName = view.roles.find((r) => r.id === roleId)?.name ?? ''
  const list = (slot: ShiftId, chosen: string | null, set: (id: string) => void, tid: string) => {
    const cands = pick(slot, chosen)
    if (cands.length === 0) {
      return (
        <div data-testid={tid} style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '8px 11px', borderRadius: 12, background: 'var(--surface-2)' }}>
          אין עובד מתאים המשובץ במשמרת זו ביום שנבחר.
        </div>
      )
    }
    return (
    <div data-testid={tid} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '24vh', overflowY: 'auto' }}>
      {cands.map((c) => (
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
  }

  return (
    <Sheet open onClose={onClose} title={`צמד 12 שעות · ${view.days[day]?.short ?? ''}`}>
      {msg && <div style={{ padding: '9px 12px', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--text)', fontSize: 13, marginBottom: 12 }}>{msg}</div>}

      {roles.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>
          לא ניתן ליצור צמד 12 שעות ביום זה — נדרש עובד משובץ גם בבוקר וגם בלילה לאותו תפקיד.
        </div>
      )}
      {roles.length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '6px 0 8px' }}>בחרו תפקיד</div>
      )}
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

          {existing12h.length > 0 && (
            <button data-testid="cancel-12h" disabled={busy} onClick={cancel} style={{
              width: '100%', marginTop: 8, padding: '10px', borderRadius: 14, fontSize: 13.5, fontWeight: 700, fontFamily: 'var(--font)',
              border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', cursor: busy ? 'default' : 'pointer',
            }}>בטל צמד 12 שעות ליום זה</button>
          )}
        </>
      )}
    </Sheet>
  )
}
