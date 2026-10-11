'use client'

import { useEffect, useId, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The keyboard and focus contract a modal overlay owes its user: Escape closes
 * it, focus moves into it on open and returns to whatever opened it on close,
 * and Tab cycles within it instead of wandering into the page behind the scrim.
 *
 * Deliberately does NOT mark the rest of the app inert/aria-hidden: with a
 * scrim present it buys little, and it would break the Playwright suite's
 * click-the-scrim-to-dismiss interactions.
 *
 * Give `panelRef` to the panel element and `tabIndex={-1}` so it can receive
 * focus; use `titleId` for both the title element's id and aria-labelledby.
 */
export function useDialogA11y({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => opener?.focus?.()
  }, [open])

  return { panelRef, titleId }
}
