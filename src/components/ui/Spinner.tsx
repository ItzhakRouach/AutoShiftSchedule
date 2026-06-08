import React from 'react'

interface SpinnerProps {
  /** Diameter in px. */
  size?: number
  /** Ring thickness in px. */
  thickness?: number
  /** Override color (defaults to currentColor via the .spinner class). */
  color?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

/**
 * A small rotating ring. Inherits `currentColor` so it matches the surrounding
 * text/button color out of the box. Animation lives in globals.css (`.spinner`).
 */
export function Spinner({ size = 18, thickness = 2, color, style, ...rest }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={rest['aria-label'] ?? 'טוען'}
      className="spinner"
      style={{
        width: size,
        height: size,
        borderWidth: thickness,
        color,
        ...style,
      }}
    />
  )
}
