'use client'

import { useActionState, useState, useTransition } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { setActiveWorkplace, addWorkplace, type AddWorkplaceState } from '@/lib/workplace/actions'

interface Props {
  workplaces: { id: string; name: string }[]
  activeId: string
}

const initialState: AddWorkplaceState = {}

export function WorkplaceSwitcher({ workplaces, activeId }: Props) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [state, action, pending] = useActionState(addWorkplace, initialState)
  const [switching, startSwitch] = useTransition()
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const active = workplaces.find((w) => w.id === activeId) ?? workplaces[0]

  function switchTo(id: string) {
    if (switching || id === activeId) return
    setSwitchingId(id)
    startSwitch(async () => {
      // The action sets the cookie and revalidates the whole layout; the menu
      // closes only once the new workplace's data is in.
      await setActiveWorkplace(id)
      setOpen(false)
      setSwitchingId(null)
    })
  }

  return (
    <div style={{ position: 'relative', maxWidth: '60%' }}>
      <button
        type="button"
        data-testid="workplace-switcher"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%',
          padding: '6px 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
          border: '1px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text)', fontFamily: 'inherit',
        }}
      >
        <Icon name="home" size={16} stroke={1.9} color="var(--text-2)" />
        <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.name ?? 'מקום עבודה'}
        </span>
        <Icon name="chevronLeft" size={14} color="var(--text-3)" style={{ transform: 'rotate(-90deg)' }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 0 }} />
          <nav
            className="nav-dropdown"
            style={{
              position: 'absolute', insetInlineStart: 0, top: 'calc(100% + 6px)', zIndex: 2,
              width: 'min(280px, calc(100vw - 24px))', display: 'flex', flexDirection: 'column', gap: 2,
              padding: 8, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lift)',
            }}
          >
            {workplaces.map((w) => {
              const isActive = w.id === activeId
              const isSwitching = switching && switchingId === w.id
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => switchTo(w.id)}
                  disabled={switching}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 12px',
                    borderRadius: 'var(--r-md)', border: 'none', fontFamily: 'inherit',
                    cursor: switching ? 'default' : 'pointer',
                    opacity: switching && !isSwitching ? 0.55 : 1,
                    textAlign: 'right', fontSize: 14, fontWeight: isActive ? 700 : 600,
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  {isSwitching ? (
                    <Spinner size={16} aria-label="מחליף מקום עבודה" />
                  ) : (
                    <Icon name={isActive ? 'check' : 'home'} size={18} stroke={1.9} />
                  )}
                  {w.name}
                </button>
              )
            })}

            <div style={{ height: 1, background: 'var(--border)', margin: '6px 8px' }} />

            {adding ? (
              <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 6px' }}>
                <input
                  name="name" autoFocus placeholder="שם מקום העבודה החדש" dir="rtl"
                  style={{
                    padding: '9px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)',
                    background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
                  }}
                />
                {state.fieldErrors?.name && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{state.fieldErrors.name}</span>}
                {state.error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{state.error}</span>}
                <button
                  type="submit" disabled={pending}
                  style={{
                    padding: '9px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)',
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {pending ? 'יוצר…' : 'צור מקום עבודה'}
                </button>
              </form>
            ) : (
              <button
                type="button" onClick={() => setAdding(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 12px',
                  borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--accent)', background: 'transparent',
                }}
              >
                <Icon name="plus" size={18} stroke={2.2} />
                הוסף מקום עבודה
              </button>
            )}
          </nav>
        </>
      )}
    </div>
  )
}
