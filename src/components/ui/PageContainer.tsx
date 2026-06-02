import React from 'react'

interface Props {
  /** 'wide' for data-heavy pages (dashboard/team/schedule), 'narrow' for forms. */
  width?: 'wide' | 'narrow'
  children: React.ReactNode
  style?: React.CSSProperties
}

/**
 * Shared responsive page container: full-width with side padding on mobile,
 * comfortably centered with a wider cap on desktop (see `.page-wrap` in
 * globals.css). Replaces the old hard-coded `maxWidth: 520; margin: 0 auto`.
 */
export function PageContainer({ width = 'wide', children, style }: Props) {
  return (
    <div className={`page-wrap ${width}`} style={{ direction: 'rtl', ...style }}>
      {children}
    </div>
  )
}
