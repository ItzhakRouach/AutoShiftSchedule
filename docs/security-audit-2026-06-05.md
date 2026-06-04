# Security Audit — AutoShiftSchedule

- Date: 2026-06-05
- Auditor: Warden (Shimon)
- Scope: multi-tenant safety for production rollout
- Method: read-only static review of source + SQL migrations (no live DB probing, no `npm audit` executed in this session — see Out-of-scope)

---

## 1. Executive Summary

Overall posture is **good**. The RLS model is consistent, helper functions (`owns_workplace`, `owns_employee`, `owns_period`, `is_my_employee`) are `SECURITY DEFINER` + `stable` with `set search_path = public`, and every user-facing table has RLS enabled with policies scoped through those helpers. Service-role usage is minimal and well-isolated. Server Actions consistently call `supabase.auth.getUser()` and re-verify workplace ownership before mutating, and Zod is used at every mutation boundary.

Top issues to ship now:

1. **High — Public storage bucket exposes every workplace's schedule image to anyone who can guess a period UUID.** `schedule-images` bucket is public, files are named `${periodId}.png`, and any visitor can fetch `https://<project>.supabase.co/storage/v1/object/public/schedule-images/<uuid>.png` with no auth. The WhatsApp share flow depends on this. The UUID v4 entropy mitigates this enough to call it "Important" rather than "Critical", but it is not real authorization — it is security-through-obscurity for tenant data (employee names + week dates).
2. **High — Cron-publish via `supabase.from('schedule_periods').update({ status: 'published' })` runs with the user's anon JWT, but `buildAndUploadScheduleImage` is then called with the service-role admin client and writes a publicly readable PNG without verifying the period was the one the user just published.** Combined with issue #1, a manager could in theory request rendering of any period UUID they happen to learn. In practice the only call site is right after the ownership-checked update, but this is a sharp edge; the helper should re-derive `workplace_id` from period and assert ownership.
3. **High — `joinWithInvite` does not enforce a "one workplace per user" invariant on the employee side.** A single auth user may end up linked to `employees` rows in multiple workplaces (the code intentionally supports it via `joinAsCurrentUser`, see `page.tsx:96-97`). This is documented intent, but employee-side reads (`resolveUserRole`, `resolveEmployee` in `me/requests/actions.ts`) silently pick "the first" row, which means a malicious or careless user can be redirected to an unintended workplace and have their `/me` actions land there. This is a Med-leaning-High UX/authz hazard: confirm the intent and fix the resolver, or block multi-workplace at the data layer.

Below: 18 findings. **No Critical findings.** 3 High, 7 Medium, 8 Low.

---

## 2. Findings

### F-01 [High] Public Supabase storage bucket leaks schedule images by UUID
- Location: `supabase/migrations/20260531000012_schedule_images_bucket.sql:1-21`, `src/lib/publish/image.ts:67-72`, `src/app/(manager)/schedule/ShareButton.tsx:18-22`
- The `schedule-images` bucket is created `public: true`. The object name is `${periodId}.png`. Anyone with the project URL and a valid period UUID can `GET /storage/v1/object/public/schedule-images/<uuid>.png` with no auth — no JWT, no session, no signature. The WhatsApp share message embeds this URL.
- Employee names + the weekly arrangement of who works which shift are tenant-sensitive (in a security-domain product especially — knowing the guard schedule is a real-world risk).
- Period IDs are random UUIDv4 (≈122 bits of entropy), so guessing is infeasible, but if a URL is ever forwarded, leaked, cached by WhatsApp, indexed, or appears in server logs, it remains world-readable for the life of the object.
- **Recommendation:** Make the bucket private and migrate the share flow to a Supabase **signed URL** with a short TTL (`createSignedUrl(path, 60 * 60 * 24 * 7)` — 7 days). Generate a fresh signed URL on each share. If WhatsApp link preview requires longer-lived URLs, namespace the storage path with a per-period HMAC-derived secret token instead of a guessable UUID.

### F-02 [High] `buildAndUploadScheduleImage` accepts any `periodId` and is reachable from two callers
- Location: `src/lib/publish/image.ts:18-76`, callers `src/app/(manager)/schedule/actions.ts:170-175` and `src/lib/publish/run.ts:77`
- The helper takes a `SupabaseClient` (always the service-role admin) + a `periodId` and renders + writes to the public bucket without any ownership check of its own. Both current callers gate before invoking it, but: (a) `publishSchedule` updates and only then renders, so if a manager-side bug ever lets `update` succeed for a foreign period (and you change RLS later), this writes anyone's schedule to the public bucket; (b) `publishDuePeriods` runs with service role and trusts the queried period set.
- **Recommendation:** Defensive — load the period inside the helper and `return null` if not found. This is already done (line 27). Good. But also: include the workplace_id (or a hash of it) in the storage path namespace so a leaked period UUID can't be turned into a directory of guessable resources for another workplace. Together with F-01 this becomes "use signed URLs in a private bucket and namespace the path".

### F-03 [High] Multi-workplace employees confuse role resolution and per-action workplace targeting
- Location: `src/lib/auth/role.ts:46-52` (`resolveUserRole` uses `.limit(1)`), `src/app/(employee)/me/requests/actions.ts:14-21` (`resolveEmployee` uses `.limit(1).maybeSingle()`), `src/app/join/[code]/page.tsx:96-97` (multi-workplace explicitly allowed)
- A user with employees rows in two workplaces will silently resolve to whichever row Postgres returns first. `saveDayRequest` then accepts an `employeeId` from the form, validates that it equals `employee.id` (the FIRST row) — meaning the user's "other" employee row is unreachable through the UI; worse, if the client manipulates the `employeeId` field to point at their OTHER (legitimate) employee row, the action returns "אין הרשאה" because `employee.id !== employeeId`. So the second workplace is partially blocked.
- This isn't a data-exposure bug — RLS still enforces `is_my_employee` — but it is an authorization correctness bug. Either (a) deliberately block multi-workplace at the data layer with `unique (user_id)` on `employees` and reject the join, or (b) build a real "active workplace" selector for employees (cookie-based, like managers use) and update both resolvers to honor it.
- **Recommendation:** Pick one. If multi-workplace is product intent, mirror the manager `active_workplace_id` cookie pattern in `me/`. Otherwise add `alter table employees add constraint employees_user_unique unique (user_id);` and reject the join with a clear Hebrew error.

### F-04 [Med] `invite-actions.ts` queries dropped columns (`greenapi_instance/_token`)
- Location: `src/app/(manager)/team/invite-actions.ts:131-140`
- The code selects `greenapi_instance, greenapi_token` from `workplace_settings`, but those columns were dropped in migration `20260602130000_drop_whatsapp_group.sql`. The select returns `undefined` for both, so the code falls through to "GreenAPI לא מוגדר" — meaning `sendInviteToPhone` is effectively a no-op that always returns the soft warning. This is dead/broken code rather than a security hole, but it indicates server actions can run against an outdated schema view and silently degrade.
- **Recommendation:** Remove `sendInviteToPhone` and `resendInviteToEmployee` if the WhatsApp-via-GreenAPI flow is gone, or restore the columns. Right now `import { sendInviteToPhone } from './invite-actions'` is still wired into `createEmployee` (`team/actions.ts:14, 89`) and runs every "create employee with sendInvite=true" path — wasted PostgREST round-trip and confusing UX.

### F-05 [Med] `auth/callback` open-redirect surface narrowed but still trusts arbitrary `next` paths
- Location: `src/app/auth/callback/route.ts:20-21`
- `next = searchParams.get('next') ?? '/reset-password'` is guarded by `if (!next.startsWith('/')) next = '/reset-password'`, so absolute URLs are blocked. Good. But `//evil.com/x` starts with `/` and most browsers treat `https://app.example.com//evil.com/x` as a redirect to `evil.com`. `NextResponse.redirect(`${origin}${next}`)` will produce that URL.
- **Recommendation:** Tighten the guard: `if (!next.startsWith('/') || next.startsWith('//')) next = '/reset-password'`. Better, validate against a static allowlist of known internal paths.

### F-06 [Med] No application-level rate limiting on login, signup, invite redemption, or password reset
- Location: `src/app/(auth)/actions.ts:22-116`, `src/app/join/[code]/actions.ts:32-163`
- Supabase Auth has its own per-IP throttle for `signInWithPassword` and `resetPasswordForEmail`, but that is project-wide, opaque, and only protects the auth endpoints — not the surrounding server actions (`joinWithInvite` does a DB lookup against `invites` for every attempt, allowing a 32^8 ≈ 10^12 brute force at HTTP speed). The invite code space is large enough to be safe in theory, but combined with no Redis/Upstash rate limit and unbounded server-action invocation, an attacker can run a quiet enumeration without tripping anything.
- **Recommendation:** Add a per-IP / per-session token-bucket rate limit (Upstash Ratelimit + `@upstash/ratelimit`, or Vercel KV) on at minimum: `/join/[code]` page renders, `joinWithInvite`, `signIn`, `requestPasswordReset`. Aim for 10/min/IP on the auth surface, 30/hour/IP on `/join/[code]`.

### F-07 [Med] Invite codes do not enforce `created_by` ownership at the DB layer
- Location: `supabase/migrations/20260531000003_employees_invites.sql:31-77`
- The `invites` table has a `created_by` column referencing `auth.users(id) on delete set null`. The `invites_manager_all` policy uses `owns_workplace(workplace_id)` only, not `created_by = auth.uid()`. That is correct (multiple managers in the same org could create invites). But: there's no constraint that `created_by` matches a user with org access. A user who can issue insert on `invites` via RLS can also forge `created_by = '<other-user-uuid>'`. Since the only RLS gate is workplace ownership and the column is just audit info, this is a Low-impact log-poisoning issue.
- **Recommendation:** Add `with check (created_by = auth.uid() OR created_by IS NULL)` to the insert path on `invites_manager_all`, or split the policy into per-verb policies and harden insert.

### F-08 [Med] `removeVacation` and `removeHoliday` trust RLS exclusively, no defense-in-depth
- Location: `src/app/(employee)/me/requests/actions.ts:199-216`, `src/app/(manager)/settings/holiday-actions.ts:81-97`
- Both actions skip the `auth.getUser()` + workplace-ownership pre-check and rely solely on RLS to scope the `delete` by id. RLS is correct (`vacations_employee_all` uses `is_my_employee`; `holidays_manager_all` uses `owns_workplace`), so in the current state this is safe. But the pattern is inconsistent with the rest of the codebase and one RLS regression silently turns these into IDOR-by-uuid attacks. The error path `'שגיאה במחיקת חופשה'` also doesn't distinguish "not yours" from "DB error", which is good — but defense-in-depth is missing.
- **Recommendation:** Mirror the rest of the codebase: `auth.getUser()` first, then check ownership via `getActiveWorkplace` (for the holiday case) or `resolveEmployee` (for the vacation case) before the delete. Cheap insurance.

### F-09 [Med] `deleteMyAccount` deletes employees rows across ALL workplaces, then auth user — confirmation flow not visible in audit scope
- Location: `src/app/(employee)/me/actions.ts:11-46`
- The action wipes every `employees` row tied to the user across all workplaces and hard-deletes the auth user. This is correct behavior for "I'm done with the product", but the action is a plain server action with no token or out-of-band confirmation. A CSRF would normally be blocked by Next 16's Origin checks on Server Actions, and the destructive outcome is fully on the authenticated user. Still — a "type your email to confirm" or a re-auth step would be appropriate for an irreversible action.
- **Recommendation:** Require a `confirm` field in the form data that matches the user's email, and reject otherwise. Same for `deleteManagerAccount` (`settings/account-actions.ts`).

### F-10 [Med] Phone numbers stored in plaintext; no encryption-at-rest beyond Postgres TDE
- Location: `supabase/migrations/20260531000003_employees_invites.sql:11`, `src/app/(manager)/team/actions.ts:58, 134`
- `employees.phone` is plaintext. RLS limits read access to the owning manager + the employee themselves, which is the appropriate gate. But for GDPR/Israeli privacy posture, phone numbers are PII and ideally encrypted at column level (pgcrypto / Supabase Vault) so a stolen DB dump leaks less.
- **Recommendation:** Optional for v1: keep plaintext. For multi-tenant production with paying workplaces: add `pgsodium`-backed encryption (Supabase Vault) on `employees.phone`. Today's bigger gap is having no encryption story documented for the user.

### F-11 [Med] `joinWithInvite` allows account creation + workplace join even if Supabase requires email verification
- Location: `src/app/join/[code]/actions.ts:117-160`
- If Supabase's email confirmation is on, `signUp` returns `{ session: null }` and the action correctly errors out with a Hebrew "verify your email" message — but only on the `data.session === null` branch (line 117). On the `signUpError` "user_already_exists" branch, the code immediately tries `signInWithPassword` — meaning a malicious actor who has knowledge of another user's email + can guess/has obtained their password can hijack the join and end up with an `employees` row created with `user_id = victim_uuid`. The window is small (they must know the password), but the action conflates "I had to log in again" with "I am the legitimate owner of this account".
- **Recommendation:** On the "already exists" branch, do NOT auto-sign-in. Return a clean error: "אימייל זה כבר רשום במערכת — התחבר/י תחילה ואז חזור/י לקישור ההזמנה". Force them through `/login` so the join only proceeds via `joinAsCurrentUser`.

### F-12 [Low] `signUp` redirects to `/onboarding` without checking that the email was actually verified
- Location: `src/app/(auth)/actions.ts:51-88`
- If verification is enabled, `signUp` returns no session, and the action correctly returns a "verify your email" error. If verification is OFF (project default), the user is autologged and redirected to `/onboarding`. This is fine — but the codebase doesn't enforce "verified email" anywhere else, so a typo'd email can become an "organization owner" with no path to recovery for the legitimate address holder.
- **Recommendation:** Turn on email confirmation in Supabase Auth settings for production. Confirm via a short doc note in `docs/architecture.md`.

### F-13 [Low] Supabase callback URL allowlist not enforced in code (project-level config concern)
- Location: project Supabase dashboard (not in repo) + `src/app/(auth)/actions.ts:111-113` (`redirectTo` for password reset)
- The reset email's `redirectTo` is `${baseUrl}/auth/callback?next=/reset-password`. `baseUrl` is derived from the request `Host` header (line 17-19), which is attacker-controlled at the HTTP layer (`X-Forwarded-Host` can be spoofed in some hosting setups; on Vercel it's normally fine). If the Supabase project allows `*.vercel.app` callback URLs, an attacker could send a reset to themselves, intercept on a preview, and redirect.
- **Recommendation:** In Supabase Auth → URL Configuration, restrict Site URL + Redirect URLs to the production domain only (no `*.vercel.app` wildcards). Also set `NEXT_PUBLIC_BASE_URL` in production env so the code uses it directly instead of trusting `Host`.

### F-14 [Low] Cron routes log to stderr but do not include workplace IDs in the response — bad observability, not a security bug
- Location: `src/app/api/cron/lock-deadline/route.ts:36-39`, `src/app/api/cron/publish/route.ts:37-39`
- Errors are pushed to a `result.errors[]` and logged with `console.error`. No correlation ID, no per-workplace error gating; one bad workplace's failure is silent in the response. Not a security issue.
- **Recommendation:** Defer.

### F-15 [Low] Service-worker registration logs to console in production
- Location: `src/app/sw-register.tsx:12`
- `console.log('[SW] Registered:', registration.scope)`. Discloses nothing sensitive but is noise.
- **Recommendation:** Wrap in `if (process.env.NODE_ENV !== 'production')`.

### F-16 [Low] Workplace settings RLS allows employees to read deadline + publish times — by design
- Location: `supabase/migrations/20260602150000_workplace_settings_member_read.sql:1-12`
- The select policy is correct. Just flagging that it means employees see `max_off_days_per_week`, working_days, all scheduling settings. This is intended ("transparency") but if anything sensitive is ever added to `workplace_settings`, this policy must be revisited.
- **Recommendation:** Add a comment in the migration / convert to explicit column-grant if you start storing secrets here (you should not — secrets belong in env).

### F-17 [Low] `schedule-image` API route allows employees to fetch any period in their workplace, including not-yet-published ones
- Location: `src/app/api/schedule-image/[periodId]/route.tsx:14-77`
- The route checks auth and then runs queries under the user's RLS. `schedule_periods` RLS lets employees SELECT all periods in their workplace, not just `published` ones. So an employee with a UUID can fetch a "draft" PNG of a `locked` or `collecting` period. The image just shows the current state. Probably fine — but `assignments_self_select` requires published-status for the employee's OWN rows, suggesting the intent is "employees only see published schedules". This route bypasses that intent.
- **Recommendation:** In the route handler, add `if (period.status !== 'published' && !isManager) return 404`. Cheap and aligns with the published-only intent of `assignments_self_select`.

### F-18 [Low] No CSP header configured; relying on framework defaults
- Location: `next.config.ts` (not read in audit; verify), no `headers()` export observed in actions/proxy
- `dangerouslySetInnerHTML` is **not used anywhere** (grep returned zero matches). React auto-escapes everything else. So XSS surface is minimal even without CSP. Still — a Content-Security-Policy header is a meaningful defense if a future component ever takes user HTML.
- **Recommendation:** Add a strict CSP in `next.config.ts` headers: `default-src 'self'; img-src 'self' https://*.supabase.co data:; connect-src 'self' https://*.supabase.co; script-src 'self' 'unsafe-inline';` (loosen as needed for Tailwind). Defer if Stitch is busy.

---

## 3. Positive findings (don't lose these)

- Every user-facing table has RLS enabled, and policies route through 4 `SECURITY DEFINER` helpers (`owns_workplace`, `owns_employee`, `owns_period`, `is_my_employee`) which are `stable` and `set search_path = public`. Clean, auditable.
- Service-role import is centralized in `src/lib/supabase/admin.ts` with the `'server-only'` directive. The exhaustive caller list is short (cron routes, publish helper, invite/join redemption, account deletion) and every caller pre-authorizes before invoking.
- `Authorization: Bearer <CRON_SECRET>` is checked on both cron routes; unauthenticated callers get 401.
- Zod is used at every server-action mutation boundary. Schemas have length caps (e.g. names ≤ 120, password ≥ 8, label ≤ 40, count ≤ 6).
- `dangerouslySetInnerHTML` is **not used anywhere** in the codebase.
- `.gitignore` excludes `.env*` (allowing only `.env.example`). The example file contains no secrets.
- `password reset` flow uses Supabase's PKCE form and `verifyOtp`, with a Hebrew "always reports success" idiom that avoids email enumeration (`actions.ts:101-116`).
- The `ensure_upcoming_period` RPC is a proper `SECURITY DEFINER` with an explicit auth check at the top (workplace owner OR employee of it). No anonymous path.
- Invite code generation uses `crypto.getRandomValues` over a 32-char alphabet at length 8 → 32^8 ≈ 1.1 × 10^12 codes, infeasible to brute-force in practice.
- RLS isolation has its own automated test (`src/lib/db/rls.test.ts`).
- Schedule-image API response sets `Cache-Control: private, no-store` so no shared cache leakage.

---

## 4. Audit log (what was actually inspected)

- All 22 SQL migrations in `supabase/migrations/` — read in full.
- `src/proxy.ts` and `src/lib/supabase/{client,server,middleware,admin}.ts`.
- All 18 server-action files:
  - `(auth)/actions.ts`
  - `(onboarding)/onboarding/actions.ts`
  - `(employee)/me/actions.ts`
  - `(employee)/me/requests/actions.ts`
  - `(manager)/settings/{actions,account-actions,holiday-actions,publish-actions,requirements-actions,roles-actions,shift-actions}.ts`
  - `(manager)/schedule/{actions,day-note-actions,edit-actions,pair-actions}.ts`
  - `(manager)/team/{actions,invite-actions}.ts`
  - `join/[code]/{actions,actions-current-user}.ts`
- API routes: `api/cron/lock-deadline/route.ts`, `api/cron/publish/route.ts`, `api/schedule-image/[periodId]/route.tsx`, `auth/callback/route.ts`.
- Storage + image flow: `src/lib/publish/image.ts`, `src/lib/publish/run.ts`, `src/lib/deadline/lock.ts`, `src/app/(manager)/schedule/ShareButton.tsx`, `src/app/api/schedule-image/schedule-image-template.tsx` (first 50 lines).
- Validation schemas: `src/lib/validation/{auth,employee,request}.ts`.
- Auth/role resolver: `src/lib/auth/role.ts`; workplace resolver: `src/lib/workplace/current.ts`.
- WhatsApp + phone: `src/lib/whatsapp/{greenapi,phone}.ts`.
- Repo hygiene: `.env.example`, `.gitignore`, `package.json`, `vercel.json`.
- `src/lib/db/rls.test.ts` (existing isolation tests).
- Grep sweeps for: `dangerouslySetInnerHTML` (0 hits), `SUPABASE_SERVICE_ROLE_KEY` / `createAdminClient` (all callers enumerated), `console.log` (1 hit in sw-register), `rateLimit|throttle` (0 hits), `GREENAPI|EVOLUTION_API` (2 hits — both server-only).

---

## 5. Out-of-scope / not audited

- **`npm audit --omit=dev`** — not executed in this session (no shell tool available to Warden in this run). Run separately: `npm audit --omit=dev --json | jq '.vulnerabilities | to_entries[] | select(.value.severity == "critical" or .value.severity == "high")'`. The dep list is small (Next 16.2.6, React 19.2.4, @supabase/ssr 0.10.3, @supabase/supabase-js 2.106.2, zod 4, hebcal, luxon, bidi-js) so triage should be quick.
- **Live RLS testing** — only the static SQL was reviewed. The existing `rls.test.ts` is a good base but only covers `organizations`. Recommend extending coverage to `employees`, `assignments`, `requests`, `day_notes`, `twelve_pair_snapshots`, `holidays`, `request_submissions`, `employee_availability`, `employee_vacations`, `shift_types`, `shift_requirements`, `workplace_settings`.
- **Supabase project dashboard config** — Allowed redirect URLs, email confirmation toggle, project-level rate limit settings, Storage bucket public-flag, RLS bypass roles. These live outside the repo. F-01 and F-13 depend on the dashboard state.
- **PWA service worker (`public/sw.js`)** — not opened. If it caches authenticated responses, that's a side-channel.
- **Playwright e2e specs** — not reviewed for security coverage; only confirmed the schedule-image spec exists.
- **`next.config.ts` headers, CSP, HSTS** — not opened in this pass. F-18 is therefore an "if not configured" note.
- **Component code** — not reviewed for XSS beyond the `dangerouslySetInnerHTML` grep. Hebrew text rendered via React is auto-escaped.
- **The image renderer's bidi handling** (`src/types/bidi-js.d.ts`, `src/lib/schedule/bidi.ts`) — not reviewed for ReDoS or untrusted-string concerns; only the template's structural code was sampled.
- **Vercel deployment configuration** — `CRON_SECRET` strength, env-var rotation policy, deployment protection on previews.

---

## 6. Recommended remediation order

1. F-01 + F-02 together — flip the bucket to private, switch to signed URLs, namespace path. (1 day)
2. F-11 — close the "already exists → auto-signin" join hole. (1 hour)
3. F-03 — decide multi-workplace product intent; add `unique (user_id)` or build an employee active-workplace selector. (half a day)
4. F-05 — one-line `//` redirect guard in `auth/callback`. (5 min)
5. F-06 — add Upstash rate limit on auth + invite actions. (half a day)
6. F-07, F-08, F-09, F-17 — defense-in-depth + UX tightening. (2 hours total)
7. F-04 — remove broken GreenAPI codepath. (15 min)
8. F-13, F-12 — Supabase dashboard config + email confirmation. (Settings, not code)
9. F-10, F-14, F-15, F-16, F-18 — deferable hardening.
