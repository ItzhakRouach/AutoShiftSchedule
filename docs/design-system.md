# Design System

Ported from `DesignTemplate/` (the approved visual reference). Match it closely (Phase 8 runs a
screenshot-comparison loop).

## Tokens
CSS custom properties in `src/styles/theme.css`: surfaces (`--bg`, `--surface`, `--surface-2`,
`--surface-sunk`), text (`--text`, `--text-2`, `--text-3`), borders (`--border`, `--border-strong`),
`--shadow`/`--shadow-lift`, `--chrome`, `--scrim`, accent (`--accent` indigo `#3457F0`, `--accent-soft`,
`--accent-ink`), radii (`--r-lg/md/sm/pill`). Themes: light (`:root`), `[data-theme="dark"]`,
`[data-theme="warm"]`. Font: **Assistant** (Hebrew). Always style via tokens, never hard-coded colors.

## Components (port from `DesignTemplate/ui.jsx`)
`Icon` (stroke set), `Card`, `Btn` (primary/soft/ghost/outline/danger), `RoleChip`, `Avatar`, `ShiftDot`,
`SectionTitle`, `Stat`, `Sheet` (bottom sheet), `Toggle`, `Segmented`, `Stepper`. Manager screens in
`DesignTemplate/manager.jsx`, employee screens in `employee.jsx`, shell/nav in `app.jsx`.

## Layout
Mobile-first, RTL. Reference frame is 392px wide; build responsive from there. Use logical CSS
properties (`inline-start`/`inline-end`) so RTL is automatic.

- **Navigation:** below 1024px a fixed bottom tab bar (`components/nav/BottomNav.tsx`); from 1024px the
  tab row in the top bar. The page reserves room for the bar via `--bottom-nav-h` — anything pinned to
  the bottom of the viewport must add it (see `.sched-actionbar`, `.submit-bar-sticky`).
- **Overlays:** `Sheet` is the one modal surface — a bottom sheet on phones, a centered dialog on
  desktop — with dialog role, Escape, a close button and a focus trap. `Drawer` is the side panel.
  Don't hand-roll `position: fixed` modals.
- **Schedule page:** primary actions live in the pinned `ScheduleActionBar` (publish / auto-assign /
  "עוד"); less common ones in `MoreActionsSheet`. The live per-worker panel (`BalancePanel`) docks
  beside the week table from 1280px. Marks in the grid are explained by `ScheduleLegend` — add an entry
  there when adding a new mark.

## Direction A (2026-11)
The redesign keeps the indigo accent and Assistant but restructures the screens around "what do I do
next": the manager dashboard opens on the week in work, the employee home on the next shift, and the
assign window shows each candidate's week so far. Noon is teal (`#0E9384`) so it never reads as the
danger coral. Labels use plain words ("12 שעות", "שיבוץ אוטומטי") — avoid abbreviations like "12ש׳"
outside narrow column headers.
