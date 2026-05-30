# Phase 0: Scaffold & Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Next.js + TypeScript + Tailwind + Supabase PWA shell with Hebrew/RTL, the design-token system ported from `DesignTemplate/`, testing tooling, a ≤200-line `CLAUDE.md`, and git — so all later phases have a working, type-checked, testable foundation.

**Architecture:** Next.js App Router (React Server Components + Server Actions), Supabase for DB/Auth (local dev via Supabase CLI), Tailwind v4 with CSS custom properties carrying the theme tokens. Vitest for unit tests, Playwright for E2E. PWA via manifest + service worker.

**Tech Stack:** Next.js (latest, App Router, TS), Tailwind CSS v4, @supabase/supabase-js + @supabase/ssr, Vitest, Playwright, @hebcal/core (later phases).

---

## Files (created/modified in this phase)
- Create: project scaffold (`package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`)
- Create: `src/styles/theme.css` (CSS variables ported from `DesignTemplate/theme.jsx`)
- Create: `src/lib/domain/constants.ts` (ROLE_META, SHIFT_META, etc.)
- Create: `src/lib/supabase/{client.ts,server.ts,middleware.ts}`
- Create: `supabase/` (via `supabase init`)
- Create: `public/manifest.webmanifest`, PWA icons, `app/sw.ts` or next-pwa config
- Create: `vitest.config.ts`, `src/lib/domain/constants.test.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`
- Create: `CLAUDE.md`, `docs/{architecture,scheduling-engine,design-system,whatsapp}.md`
- Create: `.env.local`, `.env.example`, `.gitignore`

---

### Task 1: Scaffold Next.js + git

**Files:** project root

- [ ] **Step 1: Create the app**

Run:
```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
npx create-next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
(When prompted about a non-empty directory because `DesignTemplate/` exists, choose to proceed/keep existing files.)

- [ ] **Step 2: Verify dev build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 3: Initialize git**

```bash
git init
printf "node_modules\n.next\n.env*.local\nsupabase/.branches\nsupabase/.temp\ntest-results\nplaywright-report\n" >> .gitignore
git add -A && git commit -m "chore: scaffold Next.js + TS + Tailwind"
```

---

### Task 2: RTL + Hebrew fonts + theme tokens

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/styles/theme.css`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Port theme CSS variables**

Create `src/styles/theme.css` with the `:root` light-theme variables from `DesignTemplate/theme.jsx:28-45` (`--bg`, `--surface`, `--surface-2`, `--surface-sunk`, `--text`, `--text-2`, `--text-3`, `--border`, `--border-strong`, `--shadow`, `--shadow-lift`, `--chrome`, `--scrim`), plus `--accent: #3457F0`, `--accent-soft`, radii (`--r-lg:22px; --r-md:16px; --r-sm:11px; --r-pill:999px`). Add `[data-theme="dark"]` and `[data-theme="warm"]` blocks from `theme.jsx:47-84`.

- [ ] **Step 2: Set RTL + fonts in layout**

In `src/app/layout.tsx`: set `<html lang="he" dir="rtl">`; load `Assistant` via `next/font/google` and apply as the body font; import `@/styles/theme.css`.

- [ ] **Step 3: Verify RTL renders**

Run: `npm run dev` then open `http://localhost:3000`.
Expected: page is right-to-left, Hebrew font applied, background uses `--bg`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: RTL Hebrew shell + theme tokens"
```

---

### Task 3: Domain constants + first unit test (TDD)

**Files:**
- Create: `src/lib/domain/constants.ts`
- Test: `src/lib/domain/constants.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install + configure Vitest**

```bash
npm i -D vitest
```
Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } })
```
Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/domain/constants.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SHIFT_META, SHIFT_ORDER, ROLES } from './constants'

describe('domain constants', () => {
  it('defines 3 base 8h shifts in order', () => {
    expect(SHIFT_ORDER).toEqual(['morning', 'noon', 'night'])
    expect(SHIFT_META.morning.hours).toBe(8)
    expect(SHIFT_META.night.start).toBe(23)
  })
  it('defines the three security roles', () => {
    expect(ROLES).toEqual(['אחמ״ש', 'מוקדן', 'מאבטח'])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./constants`.

- [ ] **Step 4: Implement constants**

Create `src/lib/domain/constants.ts` porting `ROLE_META`, `ROLES`, `SHIFT_META`, `SHIFT_ORDER` from `DesignTemplate/theme.jsx:4-16` as typed TS exports (add the 12h variants too: `m12_day` 07–19, `m12_night` 19–07, `m12_3to15` 03–15, `m12_15to3` 15–03, each `hours: 12`, `isFallback: true`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: typed domain constants + tests"
```

---

### Task 4: Supabase wiring (local)

**Files:**
- Create: `supabase/` (via CLI), `src/lib/supabase/{client.ts,server.ts,middleware.ts}`, `.env.local`, `.env.example`

- [ ] **Step 1: Install + init**

```bash
npm i @supabase/supabase-js @supabase/ssr
npx supabase init
npx supabase start
```
Expected: `supabase start` prints local API URL + anon/service keys.

- [ ] **Step 2: Env files**

Put the printed local values into `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Mirror keys (no values) into `.env.example`.

- [ ] **Step 3: Create clients**

Create `src/lib/supabase/client.ts` (browser, `createBrowserClient`), `server.ts` (`createServerClient` with cookies from `next/headers`), `middleware.ts` (session refresh) per `@supabase/ssr` docs (use context7 / supabase docs to confirm current API).

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: supabase local wiring + ssr clients"
```

---

### Task 5: PWA shell

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/*`, service worker (manual or `next-pwa`)
- Modify: `src/app/layout.tsx` (link manifest, theme-color)

- [ ] **Step 1: Manifest**

Create `public/manifest.webmanifest` (name "מִשְׁמֶרֶת", `dir: "rtl"`, `lang: "he"`, `display: "standalone"`, `start_url: "/"`, `background_color`/`theme_color` from theme, 192/512 icons). Reference it in `layout.tsx` metadata.

- [ ] **Step 2: Service worker (offline shell)**

Add `next-pwa` (or a minimal manual SW) to cache the app shell + last-viewed schedule route. Keep scope minimal (full offline data sync is out of scope).

- [ ] **Step 3: Verify installability**

Run: `npm run build && npm start`, open DevTools → Application → Manifest.
Expected: manifest valid, no errors; app installable.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: PWA manifest + service worker"
```

---

### Task 6: Playwright smoke E2E

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`

- [ ] **Step 1: Install**

```bash
npm i -D @playwright/test && npx playwright install --with-deps chromium
```

- [ ] **Step 2: Write smoke test**

Create `e2e/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
test('home renders RTL Hebrew', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})
```
Create `playwright.config.ts` with `webServer` running `npm run dev` on port 3000. Add script `"e2e": "playwright test"`.

- [ ] **Step 3: Run**

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: playwright smoke e2e"
```

---

### Task 7: CLAUDE.md (≤200 lines) + docs skeleton

**Files:**
- Create: `CLAUDE.md`, `docs/architecture.md`, `docs/scheduling-engine.md`, `docs/design-system.md`, `docs/whatsapp.md`

- [ ] **Step 1: Write CLAUDE.md**

Concise sections: project one-liner; stack; key commands (`npm run dev|build|test|e2e`, `npx supabase start|db reset`); folder map; conventions (Server Actions + Zod for mutations, RSC for reads, RTL/Hebrew, CSS-var theme); golden rules (engine is pure TS + TDD; QA gate each phase; CLAUDE.md ≤200 lines → split to `docs/`). Link to the four `docs/*.md`.

- [ ] **Step 2: Write docs skeletons**

Each `docs/*.md` gets real headers + a one-paragraph summary pointing to the master plan `docs/IMPLEMENTATION_PLAN.md` (not placeholders — short real content).

- [ ] **Step 3: Verify length**

Run: `wc -l CLAUDE.md`
Expected: ≤ 200. If over, move detail into `docs/` and re-check.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: CLAUDE.md + docs skeleton"
```

---

### Task 8: Phase 0 QA gate

- [ ] **Step 1: Full check**

Run: `npm run build && npx tsc --noEmit && npm run lint && npm test && npm run e2e`
Expected: all green.

- [ ] **Step 2: QA agent sweep**

Dispatch the `auditor` agent: "QA the Phase 0 scaffold — verify RTL/theme, Supabase local connectivity, PWA manifest validity, and that all scripts run clean. Report any issues." Fix anything found; `guard` adds regression tests for real bugs.

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: phase 0 QA gate green"
```

---

## Testing Strategy
- Unit (Vitest): domain constants now; the scheduling engine in Phase 4.
- E2E (Playwright): smoke now; full flow grows each phase.
- QA gate: `auditor` (probe + guard) at the end of every phase.

## Self-Review Notes
- Spec coverage: this plan implements Phase 0 of `docs/IMPLEMENTATION_PLAN.md` (scaffold, Supabase, RTL/theme, PWA, tooling, CLAUDE.md, QA gate). ✓
- No placeholders: all steps have exact commands/code. ✓
- Type consistency: `SHIFT_META`/`SHIFT_ORDER`/`ROLES` names match the engine references in later phases. ✓

## References
- Master roadmap: `docs/IMPLEMENTATION_PLAN.md`
- Design doc: `~/.claude/plans/flickering-wibbling-llama.md`
- Visual/token source: `DesignTemplate/theme.jsx`, `DesignTemplate/ui.jsx`
