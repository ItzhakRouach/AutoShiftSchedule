'use client'

import { useState, useTransition } from 'react'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import type { ScheduleView, ViewRequest } from '@/lib/schedule/view-data'
import type { WorkplaceVacation } from '@/lib/vacations/pending'
import { ManagerRequestEditor, type ShiftOption, type RequestEditTarget } from './ManagerRequestEditor'
import { managerClearAllRequests } from './request-actions'
import { RequestsOverviewRow, stickyName } from './RequestsOverviewRow'
import { RequestsOverviewControls } from './RequestsOverviewControls'
import { WorkerVacationSheet } from './WorkerVacationSheet'
import {
  buildRequestMap, submittedCount, buildVacationsByEmployee,
  buildWorkerVacationsByEmployee, isoForDayIndex,
} from './requests-overview-helpers'

interface Props {
  view: ScheduleView
  workerVacations: WorkplaceVacation[]
}

const BASE_KEYS = ['morning', 'noon', 'night'] as const

export function RequestsOverview({ view, workerVacations }: Props) {
  // Local copy so manager edits reflect instantly WITHOUT a full page refresh
  // (which would bounce off the requests tab) — lets them enter many in a row.
  const [requests, setRequests] = useState<ViewRequest[]>(view.requests)
  const [editing, setEditing] = useState<RequestEditTarget | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, startClear] = useTransition()
  const [vacationTarget, setVacationTarget] = useState<{ id: string; name: string } | null>(null)

  function onSaved(saved: { employeeId: string; dayOfWeek: number; isOff: boolean; preferredShiftIds: string[] }) {
    setRequests((prev) => [
      ...prev.filter((r) => !(r.employeeId === saved.employeeId && r.dayOfWeek === saved.dayOfWeek)),
      { employeeId: saved.employeeId, dayOfWeek: saved.dayOfWeek, isOff: saved.isOff, preferredShiftIds: saved.preferredShiftIds },
    ])
  }

  function clearAll() {
    startClear(async () => {
      const res = await managerClearAllRequests(view.periodId)
      setConfirmClear(false)
      if (!('error' in res)) setRequests([]) // local clear; no refresh → stay on the tab
    })
  }

  // Base-shift options the manager can pick for a worker's request.
  const shiftOptions: ShiftOption[] = BASE_KEYS.filter((k) => view.shiftTypeIdByKey[k]).map((k) => {
    const m = SHIFT_META[k as ShiftId]
    return { id: view.shiftTypeIdByKey[k], name: m?.name ?? k, color: m?.color ?? 'var(--accent)', soft: m?.soft ?? 'var(--accent-soft)' }
  })

  const reqMap = buildRequestMap(requests)
  const submitted = submittedCount(view.employees, reqMap)
  const total = view.employees.length
  const vacsByEmp = buildVacationsByEmployee(view.vacations ?? [])
  const workerVacsByEmp = buildWorkerVacationsByEmployee(workerVacations)
  // Off-day visibility: how many off-requests across the team this week, and
  // how many distinct employees filed at least one. Helps the manager spot a
  // week where mass-off requests will strain coverage.
  const offTotals = (() => {
    let total = 0
    const empsWithOff = new Set<string>()
    for (const r of requests) {
      if (r.isOff) { total += 1; empsWithOff.add(r.employeeId) }
    }
    return { total, employees: empsWithOff.size }
  })()
  // Pre-compute ISO date per day index so vacation lookups don't re-parse the
  // week start on every cell.
  const isoByDayIndex = view.days.map((d) => isoForDayIndex(view.weekStart, d.index))

  return (
    <div data-testid="requests-overview">
      <RequestsOverviewControls
        submitted={submitted}
        total={total}
        offTotal={offTotals.total}
        offEmployees={offTotals.employees}
        hasRequests={requests.length > 0}
        confirmClear={confirmClear}
        clearing={clearing}
        onClearAll={clearAll}
        onConfirmClear={() => setConfirmClear(true)}
        onCancelClear={() => setConfirmClear(false)}
      />

      <div
        style={{
          overflowX: 'auto',
          direction: 'rtl',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
        }}
      >
        <table style={{ borderCollapse: 'collapse', minWidth: 700, width: '100%', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{ ...stickyName, fontSize: 13, padding: '12px 14px' }}>עובד</th>
              {view.days.map((d) => (
                <th
                  key={d.index}
                  style={{
                    padding: '10px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'center',
                    borderLeft: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    minWidth: 80,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{d.short}</div>
                  <div style={{ fontWeight: 500, color: 'var(--text-2)', fontSize: 11, marginTop: 2 }}>{d.date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.employees.map((emp, ei) => (
              <RequestsOverviewRow
                key={emp.id}
                emp={emp}
                rowIndex={ei}
                days={view.days}
                byDay={reqMap.get(emp.id)}
                empVacs={vacsByEmp.get(emp.id) ?? []}
                isoByDayIndex={isoByDayIndex}
                shiftTypeIdByKey={view.shiftTypeIdByKey}
                onEdit={(day, req) => setEditing({
                  employeeId: emp.id,
                  employeeName: emp.name,
                  dayOfWeek: day.index,
                  dayLabel: `${day.short} ${day.date}`,
                  isOff: req?.isOff ?? false,
                  preferredShiftIds: req?.preferredShiftIds ?? [],
                })}
                onOpenVacation={() => setVacationTarget({ id: emp.id, name: emp.name })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ManagerRequestEditor
          periodId={view.periodId}
          target={editing}
          shiftOptions={shiftOptions}
          onSaved={onSaved}
          onClose={() => setEditing(null)}
        />
      )}

      {vacationTarget && (
        <WorkerVacationSheet
          employeeId={vacationTarget.id}
          employeeName={vacationTarget.name}
          vacations={workerVacsByEmp.get(vacationTarget.id) ?? []}
          onClose={() => setVacationTarget(null)}
        />
      )}
    </div>
  )
}
