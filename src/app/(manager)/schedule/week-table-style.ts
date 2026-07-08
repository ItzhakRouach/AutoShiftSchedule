import type { CSSProperties } from 'react'
import type { ShiftKey } from '@/lib/scheduling/types'

export const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']

// Frozen-column widths (RTL: pinned to the physical RIGHT edge). The role
// column's offset MUST equal the shift column's width so they don't overlap.
export const SHIFT_W = 96
export const ROLE_W = 78

export const S = {
  // NOTE: the table uses border-collapse: separate — position:sticky on table
  // cells does NOT hold with border-collapse: collapse in most browsers.
  // backfaceVisibility is a safe paint hint (a transform on the cell itself can
  // break stickiness, so the GPU-layer promotion goes on the scroll container).
  sticky: { position: 'sticky', background: 'var(--surface-2)', fontWeight: 700, borderLeft: '3px solid var(--text)', borderBottom: '1px solid var(--border)', zIndex: 2, WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' } as CSSProperties,
  dayPairBtn: { marginTop: 4, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, borderRadius: 99, border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font)' } as CSSProperties,
  // iOS WebKit (Safari/iPhone-Chrome) lazily repaints sticky cells during
  // momentum scroll → their TEXT blanks out. Putting the cell's CONTENT on its
  // own GPU layer forces it to re-composite, without a transform on the sticky
  // cell itself (which would break stickiness).
  layer: { display: 'block', WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)' } as CSSProperties,
}

/** Heatmap tint for a fill ratio in [0,1]: red (empty) → amber → green (full).
 *  Uses theme tokens via color-mix so it adapts to light/dark/sepia. */
export function healthTint(ratio: number): string {
  if (ratio >= 1) return 'color-mix(in srgb, var(--success) 16%, var(--surface-2))'
  if (ratio >= 0.5) return 'color-mix(in srgb, var(--warning) 18%, var(--surface-2))'
  return 'color-mix(in srgb, var(--danger) 16%, var(--surface-2))'
}
