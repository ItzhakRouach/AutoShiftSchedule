'use client'

import { useState, useCallback } from 'react'

/**
 * Keeps an overlay mounted until its closing transition has finished, so the
 * animation actually plays instead of the element vanishing on the first frame.
 *
 * Lifted verbatim out of Sheet, which has shipped with this logic for a while;
 * Drawer needs exactly the same behaviour, and duplicating a subtle
 * set-state-during-render pattern in two files is how they drift apart.
 *
 * Wire the returned `onTransitionEnd` to the BACKDROP (its opacity transition
 * is the reliable one — a panel that is already off-screen may not fire).
 */
export function useOverlayPresence(open: boolean) {
  // True as soon as `open` is true; false only once the close transition ends.
  const [visible, setVisible] = useState(open)

  // If the parent reopens while we are still animating out, remount now.
  // React 19 permits a conditional setState during render like this.
  if (open && !visible) {
    setVisible(true)
  }

  const onTransitionEnd = useCallback(() => {
    if (!open) setVisible(false)
  }, [open])

  return { visible, onTransitionEnd }
}
