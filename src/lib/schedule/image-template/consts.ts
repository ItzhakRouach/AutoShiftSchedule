/**
 * Flattened light-theme palette + dimensions for the schedule PNG template.
 * Satori has no color-mix()/CSS vars, so the app's `color-mix(in srgb, C 16%,
 * white)` tints are precomputed here; `flatten16` derives them for custom
 * role/shift colors so renamed workplaces still render correctly.
 */
export const TEXT = '#13161D'
export const TEXT_2 = '#5A6271'
export const TEXT_3 = '#9097A4'
export const ACCENT = '#3457F0'
export const BORDER = '#E6E8EE'
export const HEADER_BG = '#F7F8FA'
export const FRAME_BG = '#EEF0F4'
export const SURFACE = '#FFFFFF'
/** Zebra odd-row background (matches var(--bg)). */
export const ZEBRA_ODD = '#EEF0F4'

export const SHIFT_W = 96
export const ROLE_W = 78
export const COL_DIVIDER = 3 // vertical rules + shift-group dividers
export const ROW_DIVIDER = 1

/** `color-mix(in srgb, hex 16%, white)` — the role/shift label cell tint. */
export function flatten16(hex: string): string {
  return mix(hex, 0.16)
}

/** The faint zebra tint: shift soft (~13-15% alpha) at 55% over white ≈ 7-8%. */
export function zebraTint(hex: string): string {
  return mix(hex, 0.075)
}

function mix(hex: string, ratio: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return SURFACE
  const n = parseInt(m[1], 16)
  const ch = (v: number) => Math.round(v * ratio + 255 * (1 - ratio))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`
}
