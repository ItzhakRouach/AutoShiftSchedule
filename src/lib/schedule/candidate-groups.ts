// PURE grouping for the worker-selection list (SwapEditor). Buckets each roster
// worker by candidateStatus and DROPS the ones the manager shouldn't see:
//   - not eligible for the slot's role (role_override / role)
//   - already assigned elsewhere that day (assigned_other)
// No IO — fully unit-testable.
import type { EditMeta } from './edit-meta'
import { candidateStatus, type CandStatus } from './candidate-status'

/** A worker ready to render in the list, with their computed status/label. */
export interface GroupedCandidate {
  id: string
  name: string
  color: string
  status: CandStatus
  label: string
  /** hard-blocked (Shabbat/holiday/rest/max) → shown greyed in "לא זמינים". */
  disabled: boolean
}

export interface CandidateGroups {
  /** Requested this exact shift ("✓ ביקש"). */
  requested: GroupedCandidate[]
  /** Eligible and free. */
  available: GroupedCandidate[]
  /** Legal but needs an override (off-request / outside availability). */
  override: GroupedCandidate[]
  /** Hard-blocked (rest / Shabbat / holiday) — collapsed by default. */
  blocked: GroupedCandidate[]
  /** Total workers shown across all groups (drives the search-box threshold). */
  shownCount: number
}

/** Minimal shape this helper needs from a ScheduleView (kept narrow for tests). */
export interface GroupCandidatesView {
  employees: { id: string; name: string; color: string }[]
}

export interface GroupCandidatesSlot {
  day: number
  shiftKey: import('@/lib/domain/constants').ShiftId
  roleId: string
  assignedIds: string[]
  dayMeta?: { isHolidayEve: boolean; isHoliday: boolean }
}

export function groupCandidates(
  view: GroupCandidatesView,
  meta: EditMeta,
  slot: GroupCandidatesSlot,
): CandidateGroups {
  const groups: CandidateGroups = { requested: [], available: [], override: [], blocked: [], shownCount: 0 }

  for (const e of view.employees) {
    const em = meta.employees[e.id]
    if (!em) continue
    // Current occupants of THIS cell are shown above (with "הסר") — skip here.
    if (slot.assignedIds.includes(e.id)) continue

    const cand = candidateStatus({
      emp: em,
      day: slot.day,
      shiftKey: slot.shiftKey,
      roleId: slot.roleId,
      minRestHours: meta.minRestHours,
      requestedPreferred: em.preferred[slot.day],
      dayMeta: slot.dayMeta,
    })

    // Hidden entirely: wrong role, or already assigned elsewhere that day.
    if (cand.status === 'role_override' || cand.status === 'role' || cand.status === 'assigned_other') {
      continue
    }

    const row: GroupedCandidate = {
      id: e.id, name: e.name, color: e.color,
      status: cand.status, label: cand.label, disabled: cand.disabled,
    }
    if (cand.status === 'requested') groups.requested.push(row)
    else if (cand.status === 'available') groups.available.push(row)
    else if (cand.status === 'off_soft' || cand.status === 'avail_override') groups.override.push(row)
    else groups.blocked.push(row) // rest / unavailable / absent (חופשה/מילואים)
    groups.shownCount++
  }

  return groups
}
