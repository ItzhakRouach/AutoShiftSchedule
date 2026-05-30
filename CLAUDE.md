# CLAUDE.md — AutoShiftSchedule (מִשְׁמֶרֶת)

Hebrew-first / RTL **PWA for automatic shift scheduling** (security domain: אחמ״ש / מוקדן / מאבטח).
Two roles: **manager** (configures workplace, runs auto-scheduler, publishes) and **employee** (submits
weekly requests, views schedule). Engine honors requests + Israeli rules (8h/16h rest, Shabbat/holiday,
12h fallback). Free-tier stack. Visual reference: `DesignTemplate/`.

> Keep this file ≤200 lines. Deep detail lives in `docs/`. Update it when commands/structure/conventions change.

## Stack
- **Next.js 16** (App Router, React 19, TypeScript) · **Tailwind v4** + CSS variables
- **Supabase** (Postgres + Auth + RLS + Storage + Realtime) — `@supabase/ssr`
- **Vitest** (unit) · **Playwright** (E2E) · **PWA** (native `app/manifest.ts` + `public/sw.js`)
- Hosting: **Vercel** (Cron for deadline lock + scheduled publish). Images: `@vercel/og`. Holidays: `@hebcal/core`.
- Next 16 note: middleware entry point is `src/proxy.ts` (exports `proxy` + `proxyConfig`).

## Commands
```bash
npm run dev          # dev server (do NOT run blocking in agents/CI)
npm run build        # production build (must stay green)
npm run lint         # eslint
npm test             # vitest unit tests
npm run e2e          # playwright e2e (boots its own dev server)
npx tsc --noEmit     # type-check
npx supabase start   # local DB (needs Docker)  — see docs/architecture.md
npx supabase db reset# re-apply all migrations locally
```

## Project Structure
```
src/app/            # routes: (auth) (manager) (employee) api/ ; layout, manifest, sw-register
src/proxy.ts        # Next 16 middleware (Supabase session refresh)
src/lib/domain/     # constants.ts (ROLES, ROLE_META, SHIFT_META, SHIFT_ORDER, FALLBACK_12H_ORDER)
src/lib/scheduling/ # engine, constraints, shabbat-holiday, fallback (Phase 4) — pure TS, unit-tested
src/lib/supabase/   # client.ts (browser), server.ts (RSC/actions), middleware.ts (session helper)
src/lib/whatsapp/   # inviteLink (wa.me) + greenapi (optional auto-send)   [later phase]
src/lib/holidays/   # Israeli holiday calendar via @hebcal/core            [later phase]
src/styles/theme.css# design tokens (light/dark/warm CSS variables)
supabase/migrations/# forward-only SQL migrations (0001…) + RLS policies
e2e/                # playwright specs
docs/               # IMPLEMENTATION_PLAN.md + architecture/scheduling-engine/design-system/whatsapp
DesignTemplate/     # REFERENCE prototype — read for design/logic, do NOT ship or edit
```

## Conventions
- **Mutations:** Server Actions (or Route Handlers) validated with **Zod**. **Reads:** Server Components.
- **DB isolation:** every table has **RLS** scoped by org/workplace membership. Never bypass with the
  service-role key in user-facing paths.
- **RTL/Hebrew:** `<html dir="rtl" lang="he">`; UI text in Hebrew; use logical CSS props (inline-start/end).
- **Styling:** use the CSS variables in `theme.css` (`var(--surface)`, `var(--accent)`, `var(--r-md)`…),
  not hard-coded colors. Components port 1:1 from `DesignTemplate/ui.jsx`.
- **Scheduling engine is pure** (no I/O) so it is fully unit-testable; all constraint logic lives there.
- **Commits:** small and frequent; end messages with the Co-Authored-By trailer for Claude.

## Golden Rules
1. **Brainstorm/plan before building.** Specs in `docs/`, plans in `docs/superpowers/plans/`.
2. **TDD for logic** (engine, validation, stats): write the failing test first.
3. **QA gate every phase:** dispatch `auditor`/`probe`/`guard`, fix all findings before moving on. The user
   requires near-100% confidence / no bugs.
4. **Free-tier only** until distribution: no paid APIs (WhatsApp = free link/code + optional GreenAPI).
5. **Don't touch `DesignTemplate/`** — it's the reference, not the product.
6. Keep files focused (one responsibility); split when they grow unwieldy.

## Domain Quick Reference
- **Roles:** אחמ״ש, מוקדן, מאבטח (employees may hold several). **Base shifts (8h):** בוקר 07–15,
  צהריים 15–23, לילה 23–07. **12h fallback:** 07–19, 19–07, 03–15, 15–03 (only when 8h coverage impossible).
- **Hard constraints:** role match · day-off/vacation · **Shabbat** (observer blocked Fri noon+night & Sat
  morning+noon; Sat night OK) · **holiday** (same pattern around `holidays`) · min rest (default 8h) · one
  shift/day. **Soft:** requested shift · must_accept · under-min · fairness · 16h ideal rest for guards.
- **Flow:** manager configures → invites (link/code) → employees request → deadline locks → auto-schedule
  → manual edits / 12h as needed → publish → WhatsApp image. See `docs/scheduling-engine.md`.

## Pointers
- Roadmap & phases: `docs/IMPLEMENTATION_PLAN.md`
- Data model + RLS + DB run: `docs/architecture.md`
- Engine rules: `docs/scheduling-engine.md`
- Tokens & components: `docs/design-system.md`
- Invites + publish + GreenAPI: `docs/whatsapp.md`
