# Full-Codebase Audit — Security · Performance · Page Load · Duplication

**Date:** 2026-07-24 · **Scope:** AutoShiftSchedule (primary) + GuardPay-Functions (secondary). GuardPay mobile app repo: read-only reference, not audited.
**Method:** 4 parallel specialist reviewers (security/perf/duplication/cross-repo), each citing file:line + concrete impact, then adversarial verification (refute-oriented) of the highest-stakes Critical/Important claims. Verdicts below reflect the post-verification truth, not the raw reviewer claims.

## Headline

The **primary משמרת repo is in very good shape** — RLS is consistently tenant-scoped, every server action gates auth+ownership+Zod, all 10 admin-client sites are ownership-verified, storage is private, no XSS/open-redirect, lean client bundle, good index coverage. **Every real security finding lives in the secondary GuardPay-Functions repo**, and the standout (committed server key) you already know about. Adversarial verification killed/downgraded 2 of the 4 verified claims — see the ledger.

---

## Verified findings (post-adversarial)

### 🔴 Critical

**SEC-1 — Full Appwrite server API key committed to a PUBLIC GitHub repo** *(known; confirmed)*
`GuardPay-Functions/utilities/src/main.js:9-11`, `delete-account/src/main.js:8-10`, and tracked `.env`. A `standard_…` server-scoped key = full read/delete over the production salary DB + Users API; it bypasses every payload-secret gate (it's the platform key). Repo is public.
**Fix:** (1) Revoke the key in Appwrite console NOW; (2) mint minimum-scope keys per function; (3) read from `process.env.APPWRITE_API_KEY`, delete every literal `setKey("standard_…")`; (4) `git rm --cached .env` + purge history (BFG/filter-repo) or delete+recreate the repo; (5) make the repo private. **Effort: M.** Revocation (step 1) is what actually neutralizes it.

### 🟠 Important

**SEC-2 — `delete-account` function deletes an ARBITRARY user, no authorization** *(CONFIRMED)*
`GuardPay-Functions/delete-account/src/main.js:30` — `const { userId } = body;` flows straight to `users.delete(...)` (:64) + doc-wipe queries, with a full-scope key and no `x-appwrite-user-id` header check, no secret, no validation. The `utilities` DELETE_ACCOUNT case does it correctly (reads the injected header). Reachability depends on the function's Execute permission (in the Appwrite console, not the repo) — if `any`/`users`, anyone can wipe any account; the code-level gap is unconditional.
**Fix:** read `x-appwrite-user-id`, ignore body `userId` (mirror utilities); verify Execute permission ≠ `any`; ideally decommission this superseded standalone function. **Effort: S.**

**PERF-1 — `/me/schedule` runs the GuardPay reads sequentially after the main view** *(self-verified)*
`src/app/(employee)/me/schedule/page.tsx:36-52` — `gpLink`/`gpSync` depend only on `employee.id`(+`selectedId`), both `await` after the ~2-RT `getPublishedScheduleView`. The most-viewed employee page. ~+60-120ms TTFB every load. **Fix:** one `Promise.all`. **Effort: S.**

**PERF-2 — Dashboard stats: 5-deep sequential waterfall, collapsible to 2** *(self-verified)*
`src/lib/stats/fetch.ts:38-142` — `shift_requirements` (:129) needs only `workplaceId` but runs 4th; `assignments`(:112)+`requests`(:138) are mutually independent but sequential. `force-dynamic`, every dashboard load. ~+90-180ms TTFB. **Fix:** `Promise.all([employees, shiftTypes, requirements, periods])` → `Promise.all([assignments, requests])`. **Effort: M.**

**PERF-3 — Publish awaits @vercel/og render + push fan-out inline before returning** *(self-verified)*
`src/app/(manager)/schedule/lifecycle-actions.ts:35-45` — best-effort image render + push are `await`ed before the action returns, so the button sits in "מפרסם…" for the full ~1-3s instead of resolving on the status flip. **Fix:** flip status + revalidate + return first, run image/push in Next 16 `after()`. Cron path keeps awaiting. **Effort: S-M.**

**DUP-1 — ~5 manager schedule surfaces show a stale shift NAME after a rename** *(PARTIALLY-CONFIRMED — count corrected from 11→~5)*
Managers CAN rename/recolor a shift (`shift-actions.ts:35-58` `updateShift`, `ShiftsSection.tsx`), but these read the static `SHIFT_META` name instead of `view.shiftMeta` (DB-driven, already on the prop): `DayGrid.tsx:55`, `SwapEditor.tsx:109`, `CoverageIssues.tsx:23`, `RequestsOverview.tsx:52`, `RequestsOverviewRow.tsx:18`. **Corrected by verification:** DayEditor/DayList show stale *color* only (name is DB-correct there); the 4 sites reading `SHIFT_META[variant]` for 12h shifts are NON-issues (fallback shifts can't be renamed — `.eq('is_fallback', false)` at shift-actions.ts:55). **Fix:** route the ~5 name sites + 2 color sites through `shiftMetaFromRow`/`view.shiftMeta`. **Effort: S-M.**

**DUP-4 — `PageContainer` is dead code; 5 pages hand-roll its JSX** *(reviewer-verified, factual)*
`src/components/ui/PageContainer.tsx` has zero imports; me/me-requests/settings/dashboard/team each reproduce its `page-wrap` markup. **Fix:** adopt it in the 5 pages, or delete. **Effort: S.**

**DUP-6/7 — e2e helper duplication at scale** *(reviewer-verified, factual)*
14 specs define their own `signupAndOnboard` (3 diverging signatures) instead of `e2e/setup.ts`'s; `addEmployee` copied across 9 specs and NOT in setup.ts (guardpay-sync's copy already drifted to take `phone`). This is the exact "add a field, N-1 copies break" incident from repo memory, now at ~250-300 duplicated lines. **Fix:** one consolidation pass moving `signupAndOnboard`/`addEmployee`/`dismissCoverageIssues` into setup.ts. **Effort: M.**

**DUP-drift — `settlementBenefit` key-name drift between the two salary copies** *(reviewer-verified)*
`GuardPay-Functions/utilities/src/main.js:240` returns `settlementBenefit`; the app's `GuardPay/utils/salaryLogic.js:78` returns `settlementBenefitValue`. `calculateShiftPay` is byte-identical; only this one `calculateSalary` key differs. **Benign today** (the app computes salary locally, doesn't call the cloud action) but contradicts salaryLogic.js's "byte-faithful copy" header and is a landmine if the cloud path is revived. **Fix:** align the key + add a manual parity-check script. **Effort: S.**

**ROB-3 — No structured logging in FIND_ACCOUNT/IMPORT_WEEK** *(reviewer-verified)*
`main.js:163-164` never passes `{log,error}` into the handlers; every branch is a bare return. Ops cannot diagnose a failing sync from the Appwrite console. **Fix:** thread `{log,error}`, one line per branch with `userId`/`importKey`/`action` (never the secret). **Effort: S.**

### 🟡 Minor (verified or factual; fix opportunistically)

- **ROB-1 — import delete-then-create non-atomicity** *(DOWNGRADED from Important; proposed fix REJECTED)* — `import-week.js:66-86` deletes tagged docs then creates sequentially, no transaction. Verification found: low-probability trigger (~2-4s << 15s timeout), transient, and **already self-healing on retry** (next sync re-lists + replaces). The reviewer's "create-first" fix is **net-negative** — it trades silent underpay for silent DOUBLE pay (worse for a salary app) and widens the window. **Correct remediation if ever addressed:** idempotent upsert with deterministic doc IDs, OR simply rely on the existing retry-heals-it behavior (the client already surfaces a retryable error). **Effort: M — low priority.**
- **ENV-2 — `GUARDPAY_FAKE` has no prod guard** (`appwrite.ts:18`) — if ever set on Vercel prod, syncs silently fake-succeed. **Fix:** `&& process.env.NODE_ENV !== 'production'` + loud warn. **Effort: S.**
- **ENV-3 — `APPWRITE_DB_ID` triplicated** (main.js hard-codes the literal ×2; find-account/import-week use env-with-fallback). A partial edit could split reads/writes across DBs. **Fix:** one shared constant. **Effort: S.**
- **SEC-3 — `CALCULATE_SALARY` ungated** reads arbitrary `user_id` prefs (info disclosure of another user's credit-points/settlement via the derived benefit). **Fix:** derive user_id from the auth header. **Effort: S.**
- **SEC-4 — No security headers/CSP** on the app (`next.config.ts`/`proxy.ts` add none) — clickjacking/`frame-ancestors` gap. **Fix:** `headers()` block (CSP, X-Frame-Options: DENY, HSTS, nosniff). **Effort: M.**
- **SEC-5 — No rate limiting** on signIn/signUp/join/invite/`findGuardPayAccount` — brute-force + enumeration amplification. **Fix:** IP/user throttle (Upstash or Vercel WAF). **Effort: M.**
- **SEC-6 — schedule-image authz references non-existent `workplaces.owner_id`** (`api/schedule-image/[periodId]/route.tsx:37-40`) — the manager-preview branch ALWAYS 404s (fails closed → no leak, but managers can't preview unpublished-week images). **Fix:** join through `organizations`/`owns_workplace`. **Effort: S.**
- **SEC-7 — cron secret compared with `!==`** (timing-unsafe; low-value target, fails closed). **Fix:** `crypto.timingSafeEqual`. **Effort: S.**
- **DOC-1 — README says `TZ` env var is required; code now force-sets it** (`import-week.js:7`) — console setting is inert. Also undocumented: that module-load side effect transitively fixes TZ for the legacy CALCULATE actions too. **Fix:** update README + add a coupling comment. **Effort: S.**
- **PERF-4…9** (Minor): /me double-fetches shift_types+roles; /me/schedule re-reads the period row; missing `schedule_periods(workplace_id,status,week_start_date desc)` composite index; redundant `guardpay_syncs(employee_id)` index; sequential roles+employees in getRoleHeadcounts; serial per-workplace image render in publish cron. All low-impact today.
- **DUP-2/5/8**: RequestedBadge duplicated (CellEntryChip/DayEntryChip); dead `ROW_DIVIDER` constant; `dismissCoverageIssues` copied across 8 specs (zero drift).

### File-size ceiling (CLAUDE.md ≤200 lines) — already over
`TopNav.tsx` 263 · `JoinForm.tsx` 218 · `team/actions.ts` 211 · `CurrentUserJoinForm.tsx` 202 (+ `lib/scheduling/diversity.ts` 302, `types.ts` 229 outside the literal rule). 14 more files at 180-199 (next edit breaks them). Stale `docs/IMPLEMENTATION_PLAN.md` (ends Phase 10, misses GuardPay/miluim/day-notes/12h).

---

## Adversarial-verification ledger (what changed vs raw reviewer claims)

| Finding | Reviewer said | Verifier verdict | Net |
|---|---|---|---|
| SEC-1 key | Critical | (known, not re-verified) | Critical — confirmed |
| SEC-2 delete IDOR | Important | **CONFIRMED** (reachability unprovable from repo) | Important |
| DUP-1 SHIFT_META | Important, 11 sites, DayEditor/DayList worst | **PARTIAL** — ~5 name sites; DayEditor/DayList are color-only; 4 sites non-issues | Important, corrected scope |
| ROB-1 import loss | Important, create-first fix | **PARTIAL→Minor**; proposed fix **REJECTED** (would cause double-pay); retry already heals | Minor, different fix |
| PERF-1/2/3 | Important | self-verified from source | Important — confirmed |

---

## Healthy (evidence of coverage, not omission)
RLS across all 42 migrations tenant-scoped; SECURITY DEFINER RPCs all authorize the caller; storage private with signed URLs; every `'use server'` action gated; all admin-client sites ownership-verified; no XSS/open-redirect; invite codes 40-bit `crypto` no-modulo-bias + 90-day expiry; React.cache dedupe layer; loading.tsx on all 8 dynamic routes; lean bundle (luxon/hebcal server-only); good index coverage; sw.js network-first for navigations; contract error-code coverage 100% + fail-closed auth gate + exact-match email lookup.

---

## Recommended fix order (for triage)
1. **SEC-1 key rotation** (revoke + env-var + history purge) — do first, independent of everything.
2. **SEC-2 delete-account** gate (or decommission) — S, high-value.
3. **PERF-1** (S) + **PERF-3** (S-M) — cheap, felt on the hottest paths.
4. **DUP-1** ~5 name sites (S-M) — real user-visible correctness once a shift is renamed.
5. **ROB-3 logging** (S) + **ENV-2 fake guard** (S) + **ENV-3 db-id** (S) — GuardPay ops hardening batch.
6. **PERF-2** (M), **DUP-4** (S), **e2e dedup DUP-6/7** (M) — quality batch.
7. Security-hardening batch: **SEC-4 headers**, **SEC-5 rate-limit**, **SEC-3/6/7** — as a dedicated pass.
8. Defer: ROB-1 (retry heals it), file-size splits, stale docs, PERF-4…9 minors.
