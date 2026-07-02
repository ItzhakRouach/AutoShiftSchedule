'use client'

import { Btn } from '@/components/ui/Btn'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { OverriddenOff, Warning } from '@/lib/scheduling/types'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function shiftName(shift: string): string {
  return SHIFT_META[shift as ShiftId]?.name ?? shift
}

/**
 * Post-generate POPUP. Appears when the engine couldn't honor everything: it
 * explains WHAT happened, WHO is involved, and suggests concrete next steps
 * (talk to the workers, adjust requests, add staff). `roleId` fields are role
 * NAMES. Dismissible — the schedule is still shown beneath it.
 */
export function CoverageIssues({
  open,
  overridden,
  uncovered,
  view,
  onClose,
}: {
  open: boolean
  overridden: OverriddenOff[]
  uncovered: Warning[]
  view: ScheduleView
  onClose: () => void
}) {
  if (!open || (overridden.length === 0 && uncovered.length === 0)) return null
  const nameOf = (id: string) => view.employees.find((e) => e.id === id)?.name ?? '—'
  const peoplePulled = Array.from(new Set(overridden.map((o) => nameOf(o.employeeId))))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'var(--scrim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        direction: 'rtl',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 100%)', maxHeight: '85vh', overflowY: 'auto',
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lift)', padding: '20px 20px 16px',
        }}
      >
        <div style={{ fontSize: 'var(--text-h2)', fontWeight: 800, color: '#C2410C', marginBottom: 6 }}>
          בעיות כיסוי — דרושה תשומת לבך
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 14px', lineHeight: 1.6 }}>
          לא ניתן היה לאייש חלק מהמשמרות בלי לפגוע בבקשות. הנה מה שקרה ומה אפשר לעשות.
        </p>

        {uncovered.length > 0 && (
          <Section title={`לא ניתן לאייש (${uncovered.length})`}>
            {uncovered.map((w, i) => (
              <li key={i}>
                {DAY_NAMES[w.day]} · {shiftName(w.shift)} · {w.roleId}
                {w.missing > 1 ? ` ×${w.missing}` : ''}
              </li>
            ))}
          </Section>
        )}

        {overridden.length > 0 && (
          <Section title={`שובצו למרות בקשת חופש (${overridden.length})`}>
            {overridden.map((o, i) => (
              <li key={i}>
                <strong style={{ color: 'var(--text)' }}>{nameOf(o.employeeId)}</strong> — {DAY_NAMES[o.day]} · {shiftName(o.shift)} · {o.roleId}
              </li>
            ))}
          </Section>
        )}

        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>פתרונות אפשריים</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.8 }}>
            {peoplePulled.length > 0 && (
              <li>לתאם ישירות עם {peoplePulled.join(', ')} — הם שובצו למרות שביקשו חופש.</li>
            )}
            {uncovered.length > 0 && (
              <li>ללחוץ על &quot;השלם 12ש׳ אוטומטית&quot; כדי לנסות לכסות את החוסרים במשמרות 12 שעות, או לשבץ 12 שעות ידנית.</li>
            )}
            <li>לבקש מעובד לוותר על בקשת חופש באותו יום, או להגדיל את מכסת החופשים.</li>
            <li>לערוך ידנית את הסידור (לחיצה על משבצת) לפי שיקול דעתך.</li>
          </ul>
        </div>

        <div style={{ marginTop: 14 }}>
          <Btn variant="primary" size="md" style={{ width: '100%' }} onClick={onClose}>
            הבנתי
          </Btn>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}:</div>
      <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
        {children}
      </ul>
    </div>
  )
}
