'use client'

import { Btn } from '@/components/ui/Btn'

interface Props {
  busy: boolean
  onKeep: () => void
  onReplace: () => void
  onCancel: () => void
}

/** Hebrew confirmation modal shown when manual/12h edits exist and the user
 *  clicks "צור סידור אוטומטי". Lets the manager keep or discard manual rows. */
export function RegenerateConfirm({ onKeep, onReplace, onCancel, busy }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="regen-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 16, padding: '22px 20px',
          maxWidth: 340, width: '90%', direction: 'rtl',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        }}
      >
        <div id="regen-title" style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
          יצירת סידור מחדש
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 18, lineHeight: 1.55 }}>
          קיימות עריכות ידניות בסידור הנוכחי. כיצד ברצונך להמשיך?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Btn variant="primary" size="md" disabled={busy} onClick={onKeep} style={{ width: '100%' }}>
            שמור עריכות ידניות
          </Btn>
          <Btn variant="soft" size="md" disabled={busy} onClick={onReplace} style={{ width: '100%' }}>
            החלף הכול מחדש
          </Btn>
          <Btn variant="ghost" size="sm" disabled={busy} onClick={onCancel} style={{ width: '100%' }}>
            ביטול
          </Btn>
        </div>
      </div>
    </div>
  )
}
