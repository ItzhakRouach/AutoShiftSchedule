'use client'

import React, { useState, useCallback } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  // `visible` tracks whether the DOM element is mounted.
  // It becomes true as soon as `open` is true, and becomes false only after
  // the closing CSS transition ends — so the animation plays fully.
  const [visible, setVisible] = useState(open)

  // Sync: if the parent reopens while we're still mid-animation, remount.
  // This is safe to do in a derived initializer via useState; we also handle
  // the open→true transition here using a derived setter call in render.
  // React 19 allows calling setState during render if it's conditional on a
  // prop change and done before returning JSX.
  if (open && !visible) {
    setVisible(true)
  }

  const handleBackdropTransitionEnd = useCallback(() => {
    if (!open) setVisible(false)
  }, [open])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        onTransitionEnd={handleBackdropTransitionEnd}
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
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
          padding: '10px 18px 32px',
          transform: open ? 'translateY(0)' : 'translateY(102%)',
          transition: 'transform .3s cubic-bezier(.22,1,.36,1)',
          maxHeight: '82vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 38,
            height: 5,
            borderRadius: 99,
            background: 'var(--border-strong)',
            margin: '0 auto 14px',
          }}
        />
        {title && (
          <h2
            style={{
              margin: '0 0 16px',
              fontSize: 19,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.4px',
            }}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}
