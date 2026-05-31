# AutoShiftSchedule — Implementation Plan

## Overview
A Hebrew-first, RTL **PWA for automatic shift scheduling** (security domain: אחמ״ש / מוקדן / מאבטח). Managers configure a workplace, invite employees via a free WhatsApp link/code, employees submit weekly requests, and a constraint-based engine auto-generates a fair, legal schedule (8h/16h rest, Shabbat/holiday observance, 12h fallback). The schedule is published as a table image to WhatsApp. Built on Next.js + Supabase + Vercel, all on free tiers.

This plan is self-contained: an engineer with zero prior context can execute it. The visual + functional reference is the existing prototype in `DesignTemplate/` (plain React, `window` globals, RTL). The approved design doc lives at `~/.claude/plans/flickering-wibbling-llama.md`.

## Current State
- Empty project at `/Users/tzachir/Desktop/MyApps/AutoShiftSchedule`. **Not** a git repo yet.
- `DesignTemplate/` contains the full visual prototype to port:
  - `theme.jsx` — design tokens: `ROLE_META`, `SHIFT_META` (morning 07–15, noon 15–23, night 23–07; 8h each), `THEMES` (light/dark/warm CSS vars), `FONTS` (Assistant/Rubik/Heebo), `RADII`, `buildThemeVars()`.
  - `ui.jsx` — primitives: `Icon`, `Card`, `Btn`, `RoleChip`, `Avatar`, `ShiftDot`, `SectionTitle`, `Stat`, `Sheet`, `Toggle`, `Segmented`, `Stepper`.
  - `data.jsx` — domain data + **`generateSchedule(requests, requirements)`** greedy engine (roles, requests, 1 shift/day, 8h rest, min shifts, 2-pass fill, warnings, stats, coverage). **This is the seed for `lib/scheduling`.**
  - `manager.jsx` — manager screens: dashboard, schedule (with `Generating` animation + `SwapEditor`), team (`EmployeeEditor`), settings (`MgrSettings`).
  - `employee.jsx` — employee screens: home, requests (`DayEditor`), my schedule, profile.
  - `app.jsx` — shell: role select, bottom nav, mobile frame (392px).

## Desired End State
MVP: a deployed PWA where a manager signs up → creates a workplace → invites an employee (link) → employee joins & submits requests → deadline locks → manager runs auto-schedule (respecting all constraints) → publishes → schedule image is generated and shareable to WhatsApp → dashboard shows week/month/year stats. Verify by running the full E2E flow (see Testing Strategy).

## Key Discoveries (reuse these)
- **Engine logic already exists** in `DesignTemplate/data.jsx:90` (`generateSchedule`). Port to TS, add Shabbat/holiday blackout, 12h fallback, must_accept, vacation ranges.
- **Rest math** in `data.jsx:82-110` (`shiftStartAbs`/`shiftEndAbs`/`restOK`) — reuse the absolute-hour approach.
- **All UI components** map 1:1 to `DesignTemplate/ui.jsx` — port styles to Tailwind v4 + CSS vars (keep the CSS-variable theme system; it's clean).
- **Israeli labor law (validated by research):** 8h min rest; guards up to 12h routine / 14h emergency; OT ≤37h/week. Our engine codifies the 8h/16h + 12h fallback subset.
- Holiday data: use a Hebrew-calendar source (e.g. `@hebcal/core`, MIT, offline, no API) to auto-fill Israeli holidays with eve/exit.

## What We're NOT Doing (scope boundaries)
- ❌ WhatsApp Business API (paid) — only free link/code + optional GreenAPI.
- ❌ Native iOS/Android apps — PWA only.
- ❌ Payroll/time-clock/GPS attendance (table-stakes in competitors but out of MVP).
- ❌ Full constraint optimizer — greedy heuristic only.
- ❌ Multi-language — Hebrew/RTL only for v1.
- ❌ Shift-swap marketplace, WhatsApp confirm/decline replies — backlog (Phase 2+).

## QA Discipline (applies to every phase)
The user requires **near-100% confidence, no bugs**. Therefore:
- Every phase ends with a **QA gate**: dispatch the `auditor` agent, which coordinates `probe` (exploratory / edge-case bug hunting) + `guard` (regression + E2E tests that lock in behavior). The phase is not "done" until the QA gate passes and any bugs found are fixed.
- `guard` adds permanent regression tests for each fixed bug.
- Phase 10 is a final comprehensive QA sweep across the whole system.

## Implementation Approach
Vertical-ish slices that each compile, lint, type-check, and are committable. Schema supports multi-workplace from day 1, but UI focuses on a single active workplace. The scheduling engine is pure TypeScript (no I/O) so it is unit-testable in isolation (TDD). Mutations use Server Actions with Zod validation; reads use Server Components. Theme system ported as CSS custom properties + Tailwind.

---

## Phase 0: Scaffold & Foundations

### Overview
Stand up Next.js + TS + Tailwind, Supabase (local + project), RTL/PWA shell, design tokens, `CLAUDE.md`, and git.

### Changes Required
1. **Scaffold** (`scaffold-nextjs` skill): `npx create-next-app@latest` (App Router, TS, Tailwind, ESLint, `src/` dir, import alias `@/*`). `git init`.
2. **Supabase**: `npx supabase init`; add `@supabase/supabase-js` + `@supabase/ssr`; create `lib/supabase/{client,server,middleware}.ts`. Add `.env.local` keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. **RTL + fonts**: root `<html dir="rtl" lang="he">`; load Assistant/Rubik/Heebo via `next/font/google`.
4. **Design tokens**: port `DesignTemplate/theme.jsx` → `src/styles/theme.css` (CSS vars) + `tailwind` theme extension; port `ROLE_META`/`SHIFT_META` → `src/lib/domain/constants.ts`.
5. **PWA**: `manifest.webmanifest` + icons + service worker (next-pwa or manual) for offline schedule view.
6. **CLAUDE.md** (≤200 lines) + `docs/{architecture,scheduling-engine,design-system,whatsapp}.md`.
7. **Tooling**: Vitest for unit tests, Playwright for E2E.

### Success Criteria
**Automated**
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npx supabase start` runs; `npx supabase db reset` applies cleanly
- [ ] `CLAUDE.md` ≤ 200 lines (`wc -l CLAUDE.md`)
**Manual**
- [ ] `npm run dev` shows an RTL Hebrew page with the theme applied
- [ ] App installable as PWA (manifest valid in DevTools)

---

## Phase 1: Auth, Organizations & Workplaces

### Overview
Manager email/password auth, org + workplace creation, RLS isolation.

### Changes Required
1. **Migration** `supabase/migrations/0001_core.sql`: tables `organizations`, `workplaces`, `roles`, `shift_types`, `shift_requirements`, `workplace_settings` (see Data Model in design doc). Enable RLS; policies scope by `org_id` via `auth.uid()` membership.
2. **Auth**: `app/(auth)/login`, `app/(auth)/signup` using Supabase Auth; middleware to gate `(manager)` routes.
3. **Onboarding**: first-login wizard → create org + first workplace; seed default roles (אחמ״ש/מוקדן/מאבטח) and 3 shift_types (8h) + 4 twelve-hour variants (07–19, 19–07, 03–15, 15–03, `is_fallback=true`).
4. **Server Actions** `app/(manager)/settings/actions.ts` with Zod schemas for workplace + requirements CRUD.

### Success Criteria
**Automated**
- [ ] Migration applies: `npx supabase db reset`
- [ ] RLS test: user A cannot read user B's workplace (Vitest + supabase client)
- [ ] `tsc`, `lint`, `build` pass
**Manual**
- [ ] Sign up → land on onboarding → create workplace → see it persisted after refresh
- [ ] Default roles + shift types created

---

## Phase 2: Employees & Invitations

### Overview
Employee CRUD with all attributes; free invite link/code join flow.

### Changes Required
1. **Migration** `0002_employees.sql`: `employees` (user_id?, name, phone, role_ids[], min_shifts_per_week, observes_shabbat, observes_holidays, must_accept, status), `invites` (code, workplace_id, expires_at).
2. **Manager Team UI**: port `MgrTeam` + `EmployeeEditor` (`DesignTemplate/manager.jsx:331-407`). Add toggles for **שומר שבת / שומר חג / חובה לקבל בקשות (must_accept)** and multi-role selection (already in `EmployeeEditor`).
3. **Invite flow**: "הזמן עובדים" generates a code + `wa.me?text=` share link; public `app/join/[code]` page → employee signs up/links → `employees.user_id` set, status `active`.

### Success Criteria
**Automated**
- [ ] Migrations apply; `tsc`/`lint`/`build` pass
- [ ] Unit: invite code generation unique; expiry honored
**Manual**
- [ ] Manager adds employee, sets roles + שבת/חג + must_accept; persists
- [ ] Open invite link in incognito → join → appears as active employee

---

## Phase 3: Employee Requests + Deadline Lock

### Overview
Employees submit per-day preferences / day-off / vacation ranges; manager-set deadline locks editing.

### Changes Required
1. **Migration** `0003_requests.sql`: `schedule_periods` (workplace, week_start_date, status), `requests` (employee, period, per-day off/preferred_shift_ids[], plus vacation ranges date_from..date_to).
2. **Employee UI**: port `EmpRequests` + `DayEditor` (`DesignTemplate/employee.jsx:116-252`); add **vacation date-range** picker. Show deadline countdown (the "עד חמישי" badge already in design).
3. **Deadline**: `workplace_settings.request_deadline` (day-of-week + time). Server Action rejects edits after deadline; period transitions `collecting → locked`.
4. **Cron** `app/api/cron/lock-deadline/route.ts` (Vercel Cron daily) → lock periods past deadline.

### Success Criteria
**Automated**
- [ ] Migrations apply; `tsc`/`lint`/`build` pass
- [ ] Unit: request edit rejected when `now > deadline`
**Manual**
- [ ] Employee marks shifts/day-off/vacation range → saved
- [ ] After deadline, editing is blocked with a clear message

---

## Phase 4: Scheduling Engine (TDD)

### Overview
Pure-TS constraint engine. **Write tests first.** Port + extend `generateSchedule`.

### Changes Required
1. `lib/scheduling/engine.ts` (port `DesignTemplate/data.jsx:90`), `constraints.ts`, `shabbat-holiday.ts`, `fallback.ts`, `types.ts`.
2. **Hard constraints**: role match; off/vacation; **Shabbat blackout** (observer: block Fri noon+night, Sat morning+noon; Sat night OK); **Holiday blackout** (same pattern around `holidays` dates); min rest (default 8h); 1 shift/day.
3. **Soft scoring**: requested shift > must_accept priority > under-min > fairness (fewer shifts / hour balance); 16h-rest ideal bonus for guards.
4. **12h fallback**: when a slot is unstaffable under 8h shifts, propose a 12h variant (only if `allow_12h_fallback`), flagged for manager approval.
5. **Holiday source**: `lib/holidays/israel.ts` using `@hebcal/core` → dates + eve/exit; manager-editable overrides table `holidays`.

**Expanded ruleset (user-specified) — see `docs/scheduling-engine.md` for the full spec.** Adds: recurring
per-employee availability (weekday vs weekend, hard constraint); `employment_type` full/part/student with
min/max shifts and **full-time-first** ordering; **lottery** tie-break (deterministic seed) when
requesters>slots; **≥2-requests-per-employee floor** (else ≥1); **feasibility pre-check** ("enough for 8h or
are 12h needed?"). Requires a migration at the start of Phase 4: `employees.employment_type` +
`employees.max_shifts_per_week` + `employee_availability(employee_id, day_of_week, shift_type_id, allowed)`,
and EmployeeEditor UI to set them.

### Success Criteria
**Automated** (Vitest — exhaustive matrix)
- [ ] Shabbat observer never assigned Fri-noon/Fri-night/Sat-morning/Sat-noon; CAN get Sat-night
- [ ] Holiday observer blocked around configured holiday dates
- [ ] No employee gets two shifts < 8h apart
- [ ] must_accept employee's day-off always honored; requested shift prioritized
- [ ] Vacation range fully excludes those dates
- [ ] Recurring availability honored (weekday-nights-only guard; weekend-flex guard)
- [ ] employment_type min/max enforced; max never exceeded; full-time filled before part-time/student
- [ ] ≥2 requests satisfied per employee when possible, else ≥1
- [ ] Lottery: with N requesters > slots and a fixed seed, asserted winners; losers unfilled
- [ ] Feasibility pre-check returns correct OK / short-by-N / 12h-required
- [ ] 12h cases: whole week, half week, isolated single shifts, under-staffed → fallback only when allowed
- [ ] `coverage`, `stats`, `warnings` match hand-computed fixtures
- [ ] `tsc`/`lint` pass

---

## Phase 5: Manager Schedule Screen + Manual Editing

### Overview
Run engine, view by day, **fully edit the schedule manually** (including on an already-published schedule), **manually apply 12h shifts** with system warnings, and publish.

### Changes Required
1. **Migration** `0004_assignments.sql`: `assignments` (employee, period, date, shift_type, role, `source` enum: auto/manual/fallback_12h).
2. **UI**: port `MgrSchedule` + `Generating` + `SwapEditor` (`DesignTemplate/manager.jsx:88-328`). Wire "צרו סידור אוטומטי" → Server Action calls engine, persists assignments, shows coverage + warnings + 12h-fallback prompts.
3. **Manual edits (incl. published):** any slot is editable — add/remove/swap an employee. Each edit re-validates rest/role/שבת/חג via the engine's `validateAssignment()`; conflicts are shown as warnings (manager may override hard-rule-soft cases, but שבת/חג/role stay hard-blocked). Editing a **published** schedule marks affected employees and (Phase 7) can re-notify.
4. **Manual 12h shift:** manager can convert/assign a 12h variant to a slot directly. When applied, the system: (a) **warns** about implications (the 12h block occupies two adjacent 8h windows, affects the employee's rest and other slots, and flags the legal note "עד 12ש׳ בשגרה"); (b) **recomputes** coverage, rest validity, and blocks the conflicting adjacent slots automatically; (c) marks the assignment `source=manual`/`fallback_12h`.
5. **Recompute on edit:** reuse a `recomputeSchedule(grid, requirements)` equivalent (see `DesignTemplate/app.jsx:13`) so coverage/stats/warnings update live after every manual change.
6. **Publish / re-publish:** sets period `published`; triggers schedule-image generation (Phase 7); re-publish after edits is supported.

### Success Criteria
**Automated**
- [ ] Migration applies; `tsc`/`lint`/`build` pass
- [ ] Server Action persists assignments; re-run is idempotent per period
- [ ] Unit: `validateAssignment()` rejects rest/role/שבת/חג violations; allows valid ones
- [ ] Unit: applying a 12h shift blocks the overlapping adjacent slot and updates coverage/rest
- [ ] Editing a published schedule keeps it consistent (stats/coverage recomputed)
**Manual**
- [ ] Run schedule → see filled grid + coverage %; warnings for gaps
- [ ] Manual swap blocked when it violates rest/שבת/חג; allowed otherwise
- [ ] Manager edits an already-published schedule; affected employees flagged
- [ ] Manager applies a 12h shift manually → sees warning + correct recompute
- [ ] Publish/re-publish flips state; employee sees latest
**QA gate**
- [ ] `auditor` (probe + guard) deep-tests editing & 12h paths; bugs fixed; regression tests added

---

## Phase 6: Dashboard, Stats, Transparency

### Overview
Manager KPIs + per-employee hours/shifts (week/month/year) from real assignments; **explainable schedule + fairness ledger** (our differentiator).

### Changes Required
1. **UI**: port `MgrDash` (`DesignTemplate/manager.jsx:11-85`) — KPIs, hours/employee bars, role split, `Segmented` week/month/year.
2. **Stats**: SQL views / queries aggregating `assignments` by period; `lib/stats/`.
3. **Transparency**: per-assignment reason chips ("בקשה כובדה" / "מנוחה" / "חובה") and a fairness panel (nights/weekends distribution, request-honored %).
4. **Employee side**: port `EmpHome`, `EmpSchedule`, `EmpProfile` with real data.

### Success Criteria
**Automated**
- [ ] Aggregation queries return correct totals on seeded data (Vitest)
- [ ] `tsc`/`lint`/`build` pass
**Manual**
- [ ] Dashboard week/month/year toggles show correct numbers
- [ ] Employee sees their published schedule + weekly summary; reasons visible

---

## Phase 7: WhatsApp Publishing (Image + Share + GreenAPI)

### Overview
Generate a schedule table image; one-tap share; optional automatic GreenAPI send on publish day.

### Changes Required
1. **OG image**: `app/api/schedule-image/[periodId]/route.tsx` using `@vercel/og` (Satori) → RTL PNG table of the week's assignments.
2. **Share**: manager "שתף לקבוצה" button using Web Share API (`navigator.share({ files: [png] })`).
3. **GreenAPI**: `lib/whatsapp/greenapi.ts` (`sendFileByUrl` to `<groupId>@g.us`); settings UI to store instance_id/token/group (encrypted); toggle on/off; fallback to manual share.
4. **Cron** `app/api/cron/publish/route.ts` (Vercel Cron) → on `publish_day`, generate image + notify manager (+ GreenAPI send if configured).

### Success Criteria
**Automated**
- [ ] `/api/schedule-image/[id]` returns a valid PNG (Playwright/route test)
- [ ] GreenAPI module unit-tested with mocked HTTP
- [ ] `tsc`/`lint`/`build` pass
**Manual**
- [ ] Image renders correctly in RTL with all shifts/roles
- [ ] Share opens WhatsApp with image attached (mobile)
- [ ] With GreenAPI configured against a test group, schedule image arrives

---

## Phase 8: Design-Match Polish Loop

### Overview
Iterate each screen to match `DesignTemplate/` pixel-closely.

### Changes Required
- For each main screen: render in app → Playwright screenshot → compare against the corresponding `DesignTemplate` screen → fix color/spacing/typography deltas → repeat.
- Verify all three themes (light/dark/warm) and both corner styles.

### Success Criteria
**Manual**
- [ ] Each screen visually matches the reference (side-by-side review)
- [ ] Themes + RTL correct on mobile viewport (392px) and responsive up

---

## Phase 9: Deploy

### Overview
Ship to Vercel + Supabase prod.

### Changes Required
- Supabase prod project; push migrations. Vercel project; set env vars (`vercel env`). Configure Vercel Cron. Verify PWA + RLS in prod.

### Success Criteria
**Automated**
- [ ] Prod migrations applied; build deploys green
**Manual**
- [ ] Full E2E flow works on the deployed URL
- [ ] Cron jobs registered; PWA installable from prod

---

## Phase 10: Comprehensive QA Sweep

### Overview
Final full-system QA for near-100% confidence (user requirement). Coordinated by the `auditor` agent.

### Changes Required
1. `auditor` decomposes the system into test areas and dispatches `probe` (exploratory) + `guard` (regression/E2E).
2. **`probe`** hunts edge cases across: auth/RLS isolation, invites/expiry, request deadline boundaries, **every scheduling constraint** (שבת/חג boundaries incl. DST + holiday eves, 8h rest, must_accept, vacation ranges, under-staffing → 12h, manual edits on published schedules, manual 12h conflicts), stats correctness, WhatsApp image/GreenAPI, offline/PWA.
3. **`guard`** writes/locks E2E + regression tests for the full happy path and each bug found.
4. Triage matrix: every bug → fix → regression test → re-verify.

### Success Criteria
**Automated**
- [ ] Full unit + integration + E2E suite green (`npm test`, Playwright)
- [ ] Coverage report generated; engine module ~100% of constraint branches
**Manual**
- [ ] `auditor` sign-off: no open Sev-1/Sev-2 bugs
- [ ] Each historical bug has a named regression test

---

## Testing Strategy
- **Unit (Vitest):** scheduling engine (Phase 4 criteria), invite codes, deadline logic, stats aggregation, GreenAPI client (mocked).
- **Integration:** Supabase RLS isolation; Server Actions reject invalid/late input (Zod).
- **E2E (Playwright):** manager signup → workplace → invite → employee join → submit requests → deadline lock → auto-schedule → publish → image generated. Run against local Supabase.
- **Manual:** RTL/Hebrew correctness, theme switching, WhatsApp share on a real mobile device, GreenAPI against a test group.

## Performance Considerations
- Engine is in-memory greedy over ~weekly grids — trivial cost; runs in a Server Action.
- `@vercel/og` image generation is on-demand/cron — cache the PNG in Supabase Storage per period.
- Stats via SQL aggregation + indexes on `assignments(workplace_id, date)`.

## Migration Notes
- Greenfield; no existing data. Migrations are forward-only and incremental (0001→0004). Seed default roles/shift_types on workplace creation, not via migration.

## References
- Approved design doc: `~/.claude/plans/flickering-wibbling-llama.md`
- Visual + logic reference: `DesignTemplate/` (esp. `data.jsx:90` engine, `theme.jsx` tokens)
- Competitor research + Israeli labor law: summarized in the design doc's "יתרון תחרותי" section
- Holiday data: `@hebcal/core`
