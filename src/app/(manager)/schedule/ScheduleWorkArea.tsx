'use client'

import { useState, useSyncExternalStore } from 'react'
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

const PANEL_KEY = 'schedule.balancePanel'

// The hide/show choice lives in localStorage (it may be unavailable or throw in
// private windows — then the panel simply stays shown and nothing is saved).
function subscribePanel(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}
function readPanelOpen(): boolean {
  try { return localStorage.getItem(PANEL_KEY) !== 'hidden' } catch { return true }
}
function writePanelOpen(open: boolean) {
  try { localStorage.setItem(PANEL_KEY, open ? 'shown' : 'hidden') } catch { /* not persisted */ }
  window.dispatchEvent(new Event('storage')) // same-tab subscribers
}

/**
 * The manager's working surface: the schedule grid with the live balance panel
 * beside it on wide screens (below it on narrower desktops, hidden on phones —
 * see `.sched-work` in globals.css). One selected worker is shared, so picking
 * a row in the panel highlights that worker's cells in the table and vice versa.
 * The panel can be hidden to give the table the full width; the choice sticks.
 */
export function ScheduleWorkArea({ view, onSlot, onDayPair, assign, editMeta }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Server render and first paint show the panel; the stored choice applies on hydration.
  const panelOpen = useSyncExternalStore(subscribePanel, readPanelOpen, () => true)
  const togglePanel = writePanelOpen

  return (
    <div className={panelOpen ? 'sched-work' : 'sched-work is-collapsed'}>
      <div style={{ minWidth: 0 }}>
        {!panelOpen && (
          <div className="sched-balance-show">
            <button
              type="button"
              data-testid="balance-show"
              onClick={() => togglePanel(true)}
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 'var(--r-pill)', padding: '6px 14px', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}
            >
              הצגת מאזן עובדים
            </button>
          </div>
        )}
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
      {panelOpen && (
        <div className="sched-balance">
          <BalancePanel view={view} editMeta={editMeta} selectedId={selectedId} onSelect={setSelectedId} onHide={() => togglePanel(false)} />
        </div>
      )}
    </div>
  )
}
