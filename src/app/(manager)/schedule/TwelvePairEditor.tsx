'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { PairCandidateList } from './PairCandidateList'
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

/** True when this role already has a 12h assignment on the day (i.e. cancelable). */
function hasExisting12h(view: ScheduleView, day: number, roleId: string): boolean {
  return view.twelve.some((t) => t.day === day && t.roleId === roleId)
}

/**
 * Roles offered in the wizard for this day. A role R is shown when either a pair
 * can be FORMED — someone on בוקר AND someone on לילה can FILL R (held roles
 * expanded by rank, so a night מוקדן who also holds אחמ״ש counts toward an אחמ״ש
 * pair) — OR R already has a 12h on this day, so it can be CANCELED.
 */
function rolesForDay(view: ScheduleView, day: number, meta: EditMeta): { id: string; name: string }[] {
  return view.roles.filter((r) => {
    if (hasExisting12h(view, day, r.id)) return true
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
  const colorById = (id: string) => empById.get(id)?.color ?? '#888'
  const list = (slot: ShiftId, chosen: string | null, set: (id: string) => void, tid: string) => (
    <PairCandidateList cands={pick(slot, chosen)} busy={busy} onPick={set} testId={tid} colorById={colorById} />
  )

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
        {roles.map((r) => {
          const has12h = hasExisting12h(view, day!, r.id)
          return (
            <button key={r.id} onClick={() => { setRoleId(r.id); setMorning(null); setNight(null); setMsg(null) }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font)', cursor: 'pointer',
              border: `1px solid ${roleId === r.id ? 'var(--accent)' : 'var(--border)'}`,
              background: roleId === r.id ? 'var(--accent-soft)' : 'var(--surface)',
              color: roleId === r.id ? 'var(--accent)' : 'var(--text)',
            }}>
              {r.name}
              {has12h && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 8, padding: '1px 5px' }}>12ש׳</span>}
            </button>
          )
        })}
      </div>

      {roleId && existing12h.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, margin: '4px 0 12px', padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>
            ליום זה כבר משובץ צמד 12 שעות לתפקיד {roleName}
            {existing12h.map((t) => empById.get(t.employeeId)?.name).filter(Boolean).length > 0 && (
              <> ({existing12h.map((t) => empById.get(t.employeeId)?.name).filter(Boolean).join(', ')})</>
            )}. ניתן לבטלו ולחזור למשמרות הרגילות.
          </div>
          <button data-testid="cancel-12h" disabled={busy} onClick={cancel} style={{
            width: '100%', padding: '11px', borderRadius: 14, fontSize: 14, fontWeight: 800, fontFamily: 'var(--font)',
            border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', cursor: busy ? 'default' : 'pointer',
          }}>בטל צמד 12 שעות ליום זה</button>
        </>
      )}

      {roleId && existing12h.length === 0 && (
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
