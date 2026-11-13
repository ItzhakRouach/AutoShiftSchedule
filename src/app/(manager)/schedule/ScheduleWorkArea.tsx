'use client'

import { useState } from 'react'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { SlotCtx } from './SwapEditor'
import type { CellAssign } from './useCellAssign'
import { ScheduleGrids } from './ScheduleGrids'
import { BalancePanel } from './BalancePanel'

interface Props {
  view: ScheduleView
  onSlot?: (slot: SlotCtx) => void
  onDayPair?: (day: number) => void
  assign?: CellAssign
  editMeta: EditMeta | null
}

/**
 * The manager's working surface: the schedule grid with the live balance panel
 * beside it on wide screens (below it on narrower desktops, hidden on phones —
 * see `.sched-work` in globals.css). One selected worker is shared, so picking
 * a row in the panel highlights that worker's cells in the table and vice versa.
 */
export function ScheduleWorkArea({ view, onSlot, onDayPair, assign, editMeta }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="sched-work">
      <div style={{ minWidth: 0 }}>
        <ScheduleGrids
          view={view}
          onSlot={onSlot}
          onDayPair={onDayPair}
          assign={assign}
          editMeta={editMeta}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <div className="sched-balance">
        <BalancePanel view={view} editMeta={editMeta} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  )
}
