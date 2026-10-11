'use client'

import React from 'react'
import { Icon } from './Icon'
import { useOverlayPresence } from './overlay-presence'
import { useDialogA11y } from './dialog-a11y'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional line under the title — a count, a summary. */
  subtitle?: string
  testId?: string
  children: React.ReactNode
}

/**
 * A side-anchored modal overlay: full height, docked to one edge, same
 * interaction at every width.
 *
 * A sibling of Sheet rather than a `side` prop on it. Sheet is bottom-axis in
 * every dimension — column layout, translateY, maxHeight 82vh, top-only radii,
 * and a drag handle that would be a lie here — so a prop would turn all of that
 * into ternaries across its five shipped consumers. The shared mechanics live
 * in useOverlayPresence instead, which Sheet also uses.
 *
 * EDGE AND RTL. CSS transforms are NOT direction-aware: translateX(-100%) is
 * physically leftward whatever `dir` says, while justifyContent/insetInline ARE
 * direction-aware. Mixing the two silently breaks in one direction, so the edge
 * here is expressed in PHYSICAL properties throughout, with a matching
 * translate sign. It docks to the physical LEFT, which in this RTL app is the
 * trailing edge — deliberately the far side from the week table's sticky
 * shift/role columns, which are pinned to the physical right, so opening the
 * drawer never hides the row identities you are reading against.
 */
export function Drawer({ open, onClose, title, subtitle, testId, children }: DrawerProps) {
  const { visible, onTransitionEnd } = useOverlayPresence(open)
  const { panelRef, titleId } = useDialogA11y({ open, onClose })

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div
        onClick={onClose}
        onTransitionEnd={onTransitionEnd}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--scrim)',
          opacity: open ? 1 : 0,
          transition: 'opacity .25s ease',
          backdropFilter: 'blur(1.5px)',
          WebkitBackdropFilter: 'blur(1.5px)',
        }}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          // 100dvh, not 100vh: iOS Safari's dynamic toolbar makes vh overshoot.
          height: '100dvh',
          width: 'min(440px, 92vw)',
          background: 'var(--surface)',
          borderStartEndRadius: 'var(--r-lg)',
          borderEndEndRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lift)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .3s cubic-bezier(.22,1,.36,1)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-5) var(--space-5) var(--space-3)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id={titleId}
              style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}
            >
              {title}
            </h2>
            {subtitle && (
              <div className="tabular" style={{ marginTop: 3, fontSize: 'var(--text-sm)', color: 'var(--text-2)', fontWeight: 600 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              cursor: 'pointer',
            }}
          >
            <Icon name="x" size={18} stroke={2} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: 'var(--space-4) var(--space-5) var(--space-6)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
