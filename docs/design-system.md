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
Mobile-first, RTL, bottom navigation. Reference frame is 392px wide; build responsive from there. Use
logical CSS properties (`inline-start`/`inline-end`) so RTL is automatic.
