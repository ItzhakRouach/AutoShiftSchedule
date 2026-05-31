# Phase 1: Auth, Organizations & Workplaces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** A manager can sign up / log in, and on first login create an organization + first workplace, which is seeded with default roles, shift types, settings, and staffing requirements — all isolated per-user by Postgres RLS.

**Architecture:** Supabase Auth (email/password) + Postgres with Row-Level Security on a Next.js 16 App Router app. Reads via Server Components; mutations via Server Actions validated with Zod. Cloud Supabase project `autoshiftschedule` (ref `toicxomqqemqkghufhhx`); migrations pushed with the Supabase CLI.

**Tech Stack:** Next.js 16, @supabase/ssr, Supabase CLI, Zod, Vitest.

## Context & key facts
- Supabase clients already exist: `src/lib/supabase/{client,server,middleware}.ts`; session refresh in `src/proxy.ts`.
- New-style Supabase keys are in `.env.local` (publishable + secret). The app uses
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable) + `SUPABASE_SERVICE_ROLE_KEY` (secret).
- Domain constants to seed from: `src/lib/domain/constants.ts` (`ROLES`, `ROLE_META`, `SHIFT_META`,
  `SHIFT_ORDER`, `FALLBACK_12H_ORDER`).
- Default staffing reference: `DesignTemplate/data.jsx` `DEFAULT_REQUIREMENTS`.
- Migrations live in `supabase/migrations/`; push with `npx supabase db push` (CLI is linked).

## File structure (this phase)
- `supabase/migrations/0001_core.sql` — schema + RLS
- `src/lib/db/types.ts` — hand-written TS types for the new tables (or generated)
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/actions.ts`
- `src/app/(manager)/layout.tsx` — auth guard + active-workplace context
- `src/app/(manager)/onboarding/page.tsx`, `src/app/(manager)/onboarding/actions.ts`
- `src/app/(manager)/dashboard/page.tsx` — minimal landing after onboarding
- `src/lib/workplace/seed.ts` — seed defaults (roles, shift_types, settings, requirements)
- `src/lib/validation/workplace.ts` — Zod schemas
- Tests: `src/lib/**/**.test.ts`, `e2e/auth.spec.ts`

---

## Task 1: Core schema + RLS migration

**Files:** Create `supabase/migrations/0001_core.sql`

- [ ] **Step 1: Write the migration**

Tables (all `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`):
- `organizations(owner_user_id uuid not null references auth.users(id) on delete cascade, name text not null)`
- `workplaces(org_id uuid not null references organizations(id) on delete cascade, name text not null, timezone text not null default 'Asia/Jerusalem', week_start smallint not null default 0)`
- `roles(workplace_id uuid not null references workplaces(id) on delete cascade, name text not null, color text not null default '#3457F0', unique(workplace_id, name))`
- `shift_types(workplace_id uuid not null references workplaces(id) on delete cascade, key text not null, name text not null, start_hour smallint not null, hours smallint not null, color text not null, is_fallback boolean not null default false, sort smallint not null default 0, unique(workplace_id, key))`
- `shift_requirements(workplace_id uuid not null references workplaces(id) on delete cascade, day_of_week smallint not null, shift_type_id uuid not null references shift_types(id) on delete cascade, role_id uuid not null references roles(id) on delete cascade, count smallint not null default 0, unique(workplace_id, day_of_week, shift_type_id, role_id))`
- `workplace_settings(workplace_id uuid primary key references workplaces(id) on delete cascade, request_deadline_dow smallint, request_deadline_time time, publish_dow smallint, publish_time time, min_rest_hours smallint not null default 8, ideal_rest_hours smallint not null default 16, allow_12h_fallback boolean not null default true, greenapi_instance text, greenapi_token text, greenapi_group text, updated_at timestamptz default now())`

RLS — enable on every table. Add a SQL helper:
```sql
create or replace function public.owns_workplace(wp uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from workplaces w join organizations o on o.id = w.org_id
    where w.id = wp and o.owner_user_id = auth.uid()
  );
$$;
```
Policies:
- `organizations`: select/insert/update/delete where `owner_user_id = auth.uid()` (insert: `with check (owner_user_id = auth.uid())`).
- `workplaces`: using/with check `exists(select 1 from organizations o where o.id = org_id and o.owner_user_id = auth.uid())`.
- `roles`, `shift_types`, `shift_requirements`: using/with check `owns_workplace(workplace_id)`.
- `workplace_settings`: using/with check `owns_workplace(workplace_id)`.

- [ ] **Step 2: Push & verify**

Run: `npx supabase db push` (CLI linked). Then verify tables exist:
`npx supabase db dump --schema public | grep -E "create table" | head`
Expected: all six tables present. RLS enabled (dump shows `alter table ... enable row level security`).

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0001_core.sql
git commit -m "feat(db): core schema (orgs/workplaces/roles/shifts/requirements/settings) + RLS" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Auth (login / signup) + route guard

**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/actions.ts`, `src/app/(manager)/layout.tsx`, `src/lib/validation/auth.ts`, `e2e/auth.spec.ts`

- [ ] **Step 1: Zod schemas** — `src/lib/validation/auth.ts`: `signInSchema` / `signUpSchema` (email, password ≥8). Hebrew error messages.
- [ ] **Step 2: Server Actions** — `actions.ts` (`'use server'`): `signIn`, `signUp`, `signOut` using `createClient()` from `src/lib/supabase/server.ts`. On success redirect: signUp/signIn → `/dashboard` (the manager layout sends to onboarding if no org). Return field errors on failure.
- [ ] **Step 3: Pages** — RTL Hebrew forms using the design tokens (port the visual style of `DesignTemplate` RoleSelect/cards). Minimal, accessible (`<label>`, `aria`). Use `Btn`-style styling.
- [ ] **Step 4: Guard** — `src/app/(manager)/layout.tsx`: server component; `const { data: { user } } = await supabase.auth.getUser()`; if no user → `redirect('/login')`; look up the user's org; if none → `redirect('/onboarding')`; else render children with the active workplace.
- [ ] **Step 5: E2E** — `e2e/auth.spec.ts`: unauthenticated visit to `/dashboard` redirects to `/login`. (Sign-up happy path can use a seeded throwaway email; if email confirmation is on in Supabase, disable it for the project or note the limitation.)
- [ ] **Step 6: Verify** — `npm run build`, `tsc`, `lint`, `npm run e2e` green.
- [ ] **Step 7: Commit** — `feat(auth): email/password sign in/up + manager route guard`.

> Note: in the Supabase dashboard, **Auth → Providers → Email**, turn OFF "Confirm email" for now so dev/E2E sign-up works without an inbox (re-enable before public launch).

---

## Task 3: Onboarding — create org + workplace + seed defaults

**Files:** `src/app/(manager)/onboarding/page.tsx`, `src/app/(manager)/onboarding/actions.ts`, `src/lib/workplace/seed.ts`, `src/lib/validation/workplace.ts`, `src/lib/workplace/seed.test.ts`

- [ ] **Step 1 (TDD): seed unit test** — `seed.test.ts` asserts `buildSeed()` returns: 3 roles (אחמ״ש/מוקדן/מאבטח with `ROLE_META` colors), 7 shift_types (3 base from `SHIFT_ORDER` + 4 from `FALLBACK_12H_ORDER`, correct start/hours/is_fallback), default settings (`min_rest_hours:8, ideal_rest_hours:16, allow_12h_fallback:true`), and requirement rows derived from `DesignTemplate/data.jsx` `DEFAULT_REQUIREMENTS` applied to all 7 days. Run → FAIL.
- [ ] **Step 2: Implement `src/lib/workplace/seed.ts`** — pure functions building the seed payloads from `src/lib/domain/constants.ts` (no DB calls). Run test → PASS.
- [ ] **Step 3: Zod** — `workplace.ts`: `createWorkplaceSchema` (org name, workplace name, timezone default Asia/Jerusalem).
- [ ] **Step 4: Server Action** — `onboarding/actions.ts` `createWorkplace`: insert org (owner = auth.uid()), workplace, then bulk-insert seeded roles → shift_types → settings → requirements (resolve role/shift IDs after insert). Wrap so a failure doesn't leave a half-seeded workplace (insert org+workplace first; seed children; on child error, surface error). Redirect → `/dashboard`.
- [ ] **Step 5: UI** — `onboarding/page.tsx`: RTL Hebrew form (org name + workplace name), styled with tokens; submit calls the action.
- [ ] **Step 6: Minimal dashboard** — `src/app/(manager)/dashboard/page.tsx`: server component greeting + workplace name + counts (employees=0, roles=3) to prove data round-trips. (Full dashboard is Phase 6.)
- [ ] **Step 7: Verify** — build/tsc/lint/test green; manually: signup → onboarding → dashboard shows the new workplace with 3 roles + 7 shift types seeded (check Supabase table editor).
- [ ] **Step 8: Commit** — `feat(onboarding): create org+workplace and seed roles/shifts/settings/requirements`.

---

## Task 4: RLS isolation test

**Files:** `src/lib/db/rls.test.ts`

- [ ] **Step 1: Integration test** — using two Supabase clients with two different users (create via the service-role admin API in test setup), assert: user A creates a workplace; user B (anon/authed) cannot select it; service-role can. Use the cloud project's test schema or a disposable workplace cleaned up in `afterAll`.
- [ ] **Step 2: Run** — `npm test` → passes. If the cloud project makes isolation tests flaky, document running them against `supabase start` locally instead.
- [ ] **Step 3: Commit** — `test(db): RLS isolation between organizations`.

---

## Task 5: Phase 1 QA gate

- [ ] **Step 1:** `npm run build && npx tsc --noEmit && npm run lint && npm test && npm run e2e` all green.
- [ ] **Step 2:** Dispatch `auditor`/`probe`: exploratory test of auth (wrong password, duplicate email, SQL of RLS, onboarding double-submit, half-seed failure, session expiry, guard redirects). `guard` writes regression tests for any bug.
- [ ] **Step 3:** Fix all findings; commit `fix(phase-1): QA-gate fixes`.

## Testing Strategy
- Unit (Vitest): seed builders, Zod schemas.
- Integration: RLS isolation, Server Action validation rejects bad input.
- E2E (Playwright): guard redirect + (if email confirm off) signup→onboarding→dashboard.
- QA gate: auditor/probe/guard.

## Self-Review Notes
- Spec coverage: implements Phase 1 of `docs/IMPLEMENTATION_PLAN.md` (auth, org/workplace, migrations+RLS, onboarding seed, requirements data model). ✓
- Type consistency: seed builders consume `ROLE_META`/`SHIFT_META`/`SHIFT_ORDER`/`FALLBACK_12H_ORDER` exactly as defined in `src/lib/domain/constants.ts`. ✓
- No placeholders: each task has concrete SQL/steps. ✓

## References
- Master roadmap: `docs/IMPLEMENTATION_PLAN.md` · Architecture: `docs/architecture.md`
- Engine constants: `src/lib/domain/constants.ts` · Default staffing: `DesignTemplate/data.jsx`
