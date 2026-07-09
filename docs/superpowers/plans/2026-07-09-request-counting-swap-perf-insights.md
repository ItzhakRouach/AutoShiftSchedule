# Plan: Request-counting fix · Drag-to-swap · Performance · Insights + UX polish

## Context

Four asks, all explored and confirmed against the code:

1. **Request counting is wrong for 12h shifts.** A worker who requested `morning` and received a 12h day shift (07–19) — or requested `night` and received a 12h night (19–07) — is not counted as having their request honored. Verified root causes: the engine never recounts satisfaction after the 12h pass ([fill.ts:127](src/lib/scheduling/fill.ts#L127)); its `satisfiedCount` matches exact base shifts only; the DB stats match the raw `shift_type_id` (a 12h variant id never equals a requested base id) in [aggregate-index.ts](src/lib/stats/aggregate-index.ts), [aggregate.ts](src/lib/stats/aggregate.ts), [employee-summary.ts](src/lib/stats/employee-summary.ts); and the ✓ badge uses FILLS (missing the noon window of a 12h night). **Granted day-offs are ALREADY counted as honored in every displayed stat** — per user decision, the engine's internal floor stays shift-only (no scheduling behavior change for offs).
2. **Drag-to-swap.** Swapping two workers requires 4 taps today. Verified: drags carry only the employeeId (source cell lost), same-day drops are blocked, and no swap primitive exists server-side.
3. **Performance.** Verified: every `/schedule` load runs ~40 DB round-trips **and 1–2 full engine solves** (the feasibility banner re-solves the persisted schedule), and every cell edit repeats all of it via `revalidatePath` + `router.refresh` on a force-dynamic page. ~15–17 of the queries are duplicate table fetches between `getScheduleView`/`getEditMeta`/`buildEngineInput`.
4. **Standout feature + polish (user-selected):** Insights-over-time dashboard; smart empty states; mobile day-view parity; over-capacity quick-remove.

Deliver in 4 phases, each with the full gate (`tsc`, `lint`, `npm test`, `build`, files ≤200 lines) + a commit. TDD for all pure logic. Also copy this plan to `docs/superpowers/plans/` on start (repo convention).

---

## Phase A — 12h shifts count toward requests (COVERS semantics)

Use `TWELVE_HOUR_COVERS` ([fallback.ts:24](src/lib/scheduling/fallback.ts#L24)) — "the worker was actually working that window" — everywhere. (Only practical delta vs FILLS: 12h-night also satisfies a noon request.)

**Engine (TDD first):**
- Rewrite `satisfiedCount` ([request-gate.ts:14](src/lib/scheduling/request-gate.ts#L14)) to count per-day **matched preferred windows**: per day, build the set of covered windows (base entry → its shift; `is12h` entry → `TWELVE_HOUR_COVERS[a.variant]`), then count `preferred ∩ covered`. This inherently dedupes m12_day's two committed rows (morning+noon share one variant) so one request never counts twice. `requestCount`/`floorTarget` unchanged (offs stay out per decision).
- Add `recountSatisfied` after the twelve-fill pass in [fill.ts](src/lib/scheduling/fill.ts) (mirroring the recounts after diversity/night-then-off) so `stats.requestsSatisfied` and the request-gate see 12h satisfaction.
- Tests: extend `request-gate` tests + an engine-level case (noon requester given m12_night counts; morning requester given m12_day counts exactly once).

**✓ badge:** in [week-table-data.ts:61](src/lib/schedule/week-table-data.ts#L61) match the 12h entry's requested flag via a new `twelveCoversOf` helper (COVERS) in `week-table-twelve.ts` instead of `twelveFillsOf`. Employee published view shares this code — fixed automatically.

**DB stats (dashboard + employee):**
- [aggregate-index.ts](src/lib/stats/aggregate-index.ts) `indexAssignments`: accept the `shift_type_id → key` map (already built in [fetch.ts:55](src/lib/stats/fetch.ts#L55)) + its reverse; when a row's key is a 12h variant, also add `${day}:${coveredBaseId}` entries per `TWELVE_HOUR_COVERS`. `reqIsHonored` then works unchanged.
- [aggregate.ts](src/lib/stats/aggregate.ts) `aggregateFairness`: same expansion for `daysShifts`.
- [employee-summary.ts](src/lib/stats/employee-summary.ts) + [me-summary-data.ts](src/lib/stats/me-summary-data.ts): same expansion (fetch `shift_types(id,key)` there — currently only ids are selected).
- Extend existing tests (`aggregate.test.ts`, `aggregate-kpis.test.ts`, `employee-summary.test.ts`) with 12h-covers cases, incl. the off-request rows still counting as before.

## Phase B — Drag-to-swap (instant, validated, undoable)

**Gesture:** drag worker A from cell 1 onto cell 2: if cell 2 has exactly one occupant B (B≠A, neither `is12h` nor temp) → **swap**; if cell 2 is empty → **move** (vacates cell 1 — fixes today's confusing duplicate-assign on cross-day drags); palette drags (no source) keep today's assign behavior. Same-day and cross-day both allowed (the `busyDaysOf` guard is bypassed only for cell-origin drags).

- **Drag payload:** pass `srcSlot {day, shift, roleId}` props from [WeekTableBody.tsx](src/app/(manager)/schedule/WeekTableBody.tsx) into `WeekTableCell`; `onDragStart` writes a second MIME `application/x-src-slot` (JSON, incl. `is12h`) alongside the employeeId. Presence of this MIME = "came from a cell".
- **Drop:** `WeekTableCell` `onDrop` reads both MIMEs; widen `onDropEmployee(employeeId, src?)`; [WeekTable.tsx](src/app/(manager)/schedule/WeekTable.tsx) `handleDrop` decides swap/move/assign using `weekGrid` occupants and routes to a new `assign.swapWith(...)`.
- **Server:** new `swap-actions.ts` `swapSlots(periodId, a, b|null)`. Validation: extend [validate-edit.ts](src/lib/schedule/validate-edit.ts) `validateManualAssignment` with `excludeDays?: number[]` (skip listed days when building `others`) — validate A→cell2 excluding A's source day, B→cell1 excluding B's target day. Capacity checks skipped (headcount-neutral). Writes via a new **`swap_assignments` SECURITY DEFINER RPC migration** (precedented by `ensure_period`/`owns_period`; guarded by `owns_period`): same-day = update both rows' shift/role; cross-day = delete both source rows + insert both target rows in one transaction (no half-swap). `source: 'manual'`, `twelve_fills: null`.
- **Undo:** new `{ kind: 'swap', a, b }` `UndoSnapshot` in [undo-core.ts](src/lib/schedule/undo-core.ts) capturing each employee's pre-swap rows on both involved days; extend `planUndo`, the zod union + op-chain in [undo-actions.ts](src/app/(manager)/schedule/undo-actions.ts); one `HistoryEntry` (undo = swap-back, redo = swap-forward) so one Ctrl+Z reverses the gesture. Toast: "הוחלפו ✓".
- **File budget:** `WeekTableCell.tsx` is at 199 — extract the entry chip rendering into `CellEntryChip.tsx` before adding drag/drop changes.
- Tests: `undo-core` swap plan tests; swap validation tests via the pure `validateAssignmentCore` with hand-built `others`; e2e smoke optional.

## Phase C — Performance (top-ranked, evidence-backed)

1. **Stop re-solving the schedule on reads (dominant cost).** In [view-data.ts:98](src/lib/schedule/view-data.ts#L98), run `checkFeasibility` **only when the period has no assignments yet** (pre-generate guidance; `assignsRaw` already in scope) — else `feasibility: null` (the banner already renders nothing on null; the live gaps counter + coverage issues cover a built schedule). Removes 1–2 full engine solves from every load **and every cell-edit refresh**.
2. **Deduplicate table fetches.** New `src/lib/schedule/cached-reads.ts` with `React.cache`-wrapped per-request fetchers for the worst offenders (`shift_types`, `employees`, `roles`, `requests(periodId)`, `employee_vacations(approved)`, `workplace_settings`); use them in [fetch-stages.ts](src/lib/schedule/fetch-stages.ts), [view-data.ts](src/lib/schedule/view-data.ts), [edit-meta.ts](src/lib/schedule/edit-meta.ts), [vacations/pending.ts](src/lib/vacations/pending.ts). ~15 fewer round-trips per load.
3. **Parallelize the critical path.** In [schedule/page.tsx](src/app/(manager)/schedule/page.tsx): resolve `periodId` once (the `ensure_upcoming_period` RPC via a small cached helper), then `Promise.all(getScheduleView, getEditMeta, listPublishedWeeks, getWorkplaceVacations)` (getScheduleView accepts the pre-resolved periodId). Also parallelize the 3 leading serial awaits in [stats/fetch.ts:37](src/lib/stats/fetch.ts#L37).
4. Keep `router.refresh()` (correctness) — with 1–3 done each refresh drops from ~40 queries + engine solves to ~15 queries + none.
- Verification: `engine-perf.test.ts` stays green; manual before/after timing of a cell assign in dev (server log timings).

## Phase D — Insights over time + UX polish

- **Insights (dashboard):** new pure per-week series builder in `src/lib/stats/` (tested): for the periods already fetched by scope (`fetch.ts` fetches assignments/requests with `.in(period_id, ...)`), compute per-week coverage %, request-honored rate, and per-employee nights/weekends totals across the scope. Render in [DashPanels.tsx](src/app/(manager)/dashboard/DashPanels.tsx) as a compact trends card (inline SVG sparkline bars, theme tokens, no new deps) + make the fairness table respect the month/year scope. Keep every file ≤200 (new `TrendsCard.tsx`).
- **Smart empty states:** in [ScheduleClient.tsx](src/app/(manager)/schedule/ScheduleClient.tsx) (or a small `EmptyStateCard.tsx`), when there's no schedule yet detect the missing prerequisite from `view` (no employees / no roles / no requirements) and deep-link to `/team` / `/settings` with a targeted Hebrew message.
- **Mobile day-view parity:** [DayGrid.tsx](src/app/(manager)/schedule/DayGrid.tsx) — add the ✓ requested badge (via `view.requestedSet` + `shiftTypeIdByKey`, same logic as the week table incl. 12h COVERS) and the under/over capacity tints used by the desktop cells.
- **Over-capacity quick fix:** in the week-table cell, when `capacityStatus === 'over'`, show a small × next to each name that calls `unassignSlot` (existing action) and pushes an `unassign` undo entry. Lives in the new `CellEntryChip.tsx`.

---

## Sequencing & verification
Phases A → B → C → D, committing per phase after the full gate: `npx tsc --noEmit` · `npm run lint` · `npm test` (new tests per phase) · `npm run build` · `wc -l` ≤200 on touched files · manual walk-through on the running dev server (:3000). Phase B adds a migration (`swap_assignments` RPC) — apply with `supabase db push` at deploy time (same flow as the push-subscriptions migration). Deploy to production only when you say so.

Manual checks per phase:
- **A:** worker with noon request given 12h-night shows ✓ and counts in the dashboard "קיבל X מתוך Y"; off-day rows unchanged.
- **B:** drag A onto B → instant swap (same-day and cross-day), toast, single Ctrl+Z restores both; drag to empty cell moves (source vacated); 12h/temp drags fall back to old behavior; invalid swap (rest/role) shows the Hebrew reason and does nothing.
- **C:** cell assign feels immediate; server logs show no engine solve after edits on a built schedule; page still correct after edits/reload.
- **D:** dashboard shows trends over month/year scope; empty schedule deep-links to missing setup; mobile day view shows ✓ + capacity tints; over-staffed cell names have working ×.
