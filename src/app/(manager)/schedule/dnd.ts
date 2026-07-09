// Shared drag-and-drop payload for schedule cells / palette chips.
// Two MIME types: the employee id (always), and — ONLY when the drag began on a
// grid cell — the source slot. Presence of the source slot is the
// "came from a cell" discriminator that enables swap/move semantics; palette
// drags carry just the id and keep plain-assign behavior.
import type { ShiftKey } from '@/lib/scheduling/types'

export const DND_MIME = 'application/x-employee-id'
export const SRC_MIME = 'application/x-src-slot'

export interface SrcSlot {
  day: number
  shift: ShiftKey
  roleId: string
}

/** Read both payloads from a drop event (src undefined for palette drags). */
export function readDragPayload(e: React.DragEvent): { employeeId: string; src?: SrcSlot } | null {
  const employeeId = e.dataTransfer.getData(DND_MIME)
  if (!employeeId) return null
  const raw = e.dataTransfer.getData(SRC_MIME)
  if (!raw) return { employeeId }
  try {
    const p = JSON.parse(raw) as SrcSlot
    if (typeof p.day === 'number' && typeof p.shift === 'string' && typeof p.roleId === 'string') {
      return { employeeId, src: p }
    }
  } catch { /* malformed src → treat as palette drag */ }
  return { employeeId }
}
