'use client'

import React from 'react'
import { useOverlayPresence } from './overlay-presence'
import { useDialogA11y } from './dialog-a11y'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  testId?: string
  children: React.ReactNode
}

/**
 * The app's modal surface: a bottom sheet on phones and a centered dialog from
 * 1024px up (see `.sheet-wrap` / `.sheet-panel` in globals.css). Escape, the
 * close button and the scrim all dismiss it; focus is trapped while open.
 */
export function Sheet({ open, onClose, title, testId, children }: SheetProps) {
  // Mount latch + deferred unmount, shared with Drawer so the two overlays
  // cannot drift apart.
  const { visible, onTransitionEnd } = useOverlayPresence(open)
  const { panelRef, titleId } = useDialogA11y({ open, onClose })

  if (!visible) return null

  return (
    <div className="sheet-wrap" style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* Backdrop */}
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

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        data-testid={testId}
        className="sheet-panel"
        style={{
          position: 'relative',
          background: 'var(--surface)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
          padding: '10px 18px 32px',
          transform: open ? 'translateY(0)' : 'translateY(102%)',
          transition: 'transform .3s cubic-bezier(.22,1,.36,1)',
          overflowY: 'auto',
          outline: 'none',
        }}
      >
        <div className="sheet-handle" style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--border-strong)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <h2 id={titleId} style={{ flex: 1, margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: 'var(--r-sm)', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)',
              fontSize: 22, lineHeight: 1, fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
