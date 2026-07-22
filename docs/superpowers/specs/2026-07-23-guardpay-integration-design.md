# משמרת → GuardPay: Weekly Shift Import Integration

## Context

The user owns two apps: **AutoShiftSchedule (משמרת)** — a Hebrew RTL Next.js 16 + Supabase PWA where employees view their published weekly schedule — and **GuardPay** — a production Expo/React Native salary tracker on the App Store, backed by Appwrite Cloud (project `69583540003a5151db86`, DB `695835c0002144f7a605`, collections `users_prefs`, `shifts_history`).

Goal: an employee viewing their published week in משמרת taps one button and their shifts appear in GuardPay with correct dates, start/end times, and full Israeli pay-bucket math (100%/125%/150% weekday, 150%/175%/200% Shabbat from Friday 16:00, holiday variants, travel pay) using the base wage stored in their GuardPay profile.

Feasibility confirmed: GuardPay data lives in Appwrite Cloud (not on-device), the app realtime-subscribes to `shifts_history` (server-created docs appear instantly), and its salary logic already exists server-side. **Zero changes to the GuardPay mobile app** — no App Store release needed, and the app's local on-device salary computation is untouched.

### User-approved decisions
1. **Account linking**: auto-match by email (משמרת Supabase auth email → Appwrite Users API) with name confirmation; manual email entry fallback (covers Apple private-relay users, who can find their relay address in Apple ID settings). No pairing-code screen in v1.
2. **Compute + write inside the EXISTING `utilities` Appwrite Function** (id `697d0f3c001bba7f03d2`, repo GuardPay-Functions). The Appwrite free tier allows only 2 functions and both slots are used (`utilities`, `delete-account`), so no third function. `utilities/src/main.js` is already an `{action, payload}` dispatcher and already contains `calculateShiftPay` (server twin of the app's salary logic, lines 230–386) — we add two new actions (`FIND_ACCOUNT`, `IMPORT_WEEK`) beside the existing three, which are **not modified**. משמרת executes the function via REST with an executions-only API key; it never touches GuardPay data directly.
3. **Full-week sync**: imported docs tagged (`import_source`/`import_key`); re-import deletes + recreates only previously-imported docs for that week. Manually-created GuardPay shifts are never touched. Idempotent re-tap.
4. Holiday detection included in v1 (workplace `holidays` table ∪ `israeliChagDates()` from `@hebcal/core` — both already exist in משמרת).
5. Any published week is importable (including past weeks via WeekNav).

## Critical correctness constraint: timezone

`calculateShiftPay` (both in the app and in `utilities/src/main.js`) uses **local-time accessors** (`getHours()`, `getDay()`, `setHours(4,0,0,0)` — verified at utilities/src/main.js:246, 277–279, 324–326). Correct on phones (device TZ = Asia/Jerusalem), wrong on a UTC server. Therefore:
- משמרת builds true UTC instants from Israel wall-clock via **luxon** (`^3.7.2`, already a dep): `DateTime.fromISO(date, { zone: 'Asia/Jerusalem' })` — handles DST (+02/+03) and cross-midnight shifts.
- The `utilities` function gets env var **`TZ=Asia/Jerusalem`** (+ `process.env.TZ ??=` in the new module), and **IMPORT_WEEK has a runtime guard**: probe `new Date('2026-01-15T00:00:00Z').getTimezoneOffset() === -120` and a July probe `=== -180`; on failure return `{ ok:false, code:'BAD_TZ' }` — fail loudly, never mis-price. The guard gates ONLY the new action, so existing actions behave exactly as today.

## Security constraint: shared secret

`utilities` is executable by GuardPay app users (that's how the app calls it), so the new actions must not be callable by arbitrary users — IMPORT_WEEK takes a target `userId`. Guard: new env var **`MISHMERET_SECRET`** on the function; both new actions require `payload.secret === process.env.MISHMERET_SECRET` (and reject when `req.headers['x-appwrite-user-id']` is present, i.e. a user-session invocation) → else `{ ok:false, code:'UNAUTHORIZED' }`, 401. משמרת holds the secret as a server-only env var.

## Part A — Extend the `utilities` function (repo: `/Users/tzachir/Desktop/MyApps/GuardPay-Functions`)

New files (keep `main.js` from bloating past ~450 lines; ESM imports):
```
utilities/src/find-account.js   # FIND_ACCOUNT handler (injected {users, databases})
utilities/src/import-week.js    # IMPORT_WEEK handler (injected {databases, calculateShiftPay}); validation; TZ guard; doc building
utilities/test/import-week.test.js, utilities/test/find-account.test.js   # node:test, mocked clients
utilities/README.md             # ops/redeploy checklist (Part E)
```
Modified: `utilities/src/main.js` — import the two modules, add two `case` branches with the secret check, export `calculateShiftPay` (or pass it in) for reuse. Existing cases untouched. `utilities/package.json` — add `"test": "node --test test/"`.

Contract — execution body `{ action, payload }` (same envelope as today):
- **FIND_ACCOUNT** `{ secret, email }` → auth guard → normalize email → `users.list([Query.equal('email', ...), Query.limit(1)])` → not found: `{ok:false, code:'NOT_FOUND'}`; found but no `users_prefs` doc: `{ok:false, code:'NO_PREFS'}`; success: `{ok:true, userId, name: prefs.user_name || user.name, email}`.
- **IMPORT_WEEK** `{ secret, userId, importKey, shifts:[{start, end, isHoliday, comment}] }` →
  - auth guard → TZ guard
  - validate: `importKey` matches `^mishmeret:\d{4}-\d{2}-\d{2}$`, ≤20 shifts, each end > start, span ≤ 24h → else `BAD_PAYLOAD`
  - fetch `users_prefs` → `baseRate = price_per_hour`, `travelRate = price_per_ride` (missing → `NO_PREFS`)
  - delete existing: `listDocuments([equal('user_id'), equal('import_key'), limit(100)])` → delete each
  - create per shift: `calculateShiftPay(start, end, baseRate, travelRate, isHoliday)` + `user_id`, `start_time`, `end_time`, `base_rate`, `comment`, `is_training:false`, `is_vacation:false`, `is_holiday`, `import_source:'mishmeret'`, `import_key` — mirroring the exact regular-shift field set `GuardPay/app/add-shift.jsx` writes, plus the two tags (GuardPay CLAUDE.md field-name contract: add optional fields only, never rename)
  - → `{ok:true, deleted, created, totalAmount}`; errors → non-200 with `{ok:false, code, message}`.
- Store `end_time` as the true next-day instant for cross-midnight shifts (`calculateShiftPay` handles both forms; this is the cleaner one already present in production data).
- Out of scope but noted in README: the hard-coded server API key at main.js:9–11 should be rotated and moved to an env var (it's committed to GitHub).

## Part B — Supabase migration (repo: AutoShiftSchedule)

`supabase/migrations/20260723000001_guardpay_links.sql`:
- `guardpay_links` (id, employee_id **unique** FK→employees cascade, guardpay_user_id, guardpay_email, guardpay_name, created_at, updated_at)
- `guardpay_syncs` (id, employee_id FK cascade, period_id FK→schedule_periods cascade, synced_at, shift_count, **unique(employee_id, period_id)**) + index on employee_id
- RLS both tables, self-only (template: push_subscriptions policies): `for all using/with check (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()))`. No manager policy.
- Apply with `npx supabase db push` (cloud workflow — no Docker).

## Part C — משמרת server code (repo: AutoShiftSchedule)

New files:
- `src/lib/validation/guardpay.ts` — Zod: `findAccountSchema {email?: string.email}`, `syncWeekSchema {periodId: uuid}`
- `src/lib/guardpay/types.ts` — payload/result types + error-code → Hebrew message map
- `src/lib/guardpay/appwrite.ts` — `'server-only'`; `executeGuardPayFunction(action, payload)`: `fetch POST ${GUARDPAY_APPWRITE_ENDPOINT}/functions/${GUARDPAY_FUNCTION_ID}/executions`, headers `X-Appwrite-Project`/`X-Appwrite-Key`, body `{ body: JSON.stringify({action, payload: {...payload, secret}}), async:false, method:'POST', path:'/' }`; check `status==='completed'`, parse `responseBody`. **`GUARDPAY_FAKE=1` env gate** returns canned fixtures (for e2e).
- `src/lib/guardpay/holiday-dates.ts` (+ `.test.ts`) — Set of ISO dates: workplace `holidays` rows ∪ `israeliChagDates()` (`src/lib/holidays/israel.ts:31`) for weekStart..weekStart+7
- `src/lib/guardpay/build-week.ts` (+ `.test.ts`) — **pure, TDD**: `buildImportKey(weekStart)`; `buildWeekShifts({weekStart, assignments, shiftTypesById, holidaySet})` → `[{start, end, isHoliday, comment}]`. Date = weekStart + day_of_week; start = luxon Asia/Jerusalem at `shift_type.start_hour`; end = start + `hours`; `isHoliday = holidaySet.has(startDate) || (start_hour >= 16 && holidaySet.has(startDate+1))` (mirrors GuardPay's Friday-16:00 weekend analog / erev-chag). Comment: `` `יובא ממשמרת · ${shiftTypeName}` ``.
- `src/app/(employee)/me/schedule/guardpay-actions.ts` — 4 server actions mirroring the `vacation-actions.ts` idiom (`'use server'` → Zod `safeParse` → `createClient()` → `auth.getUser()` → `resolveEmployee` → mutate → `revalidatePath` → `{ok}|{error}` Hebrew):
  - `findGuardPayAccount(input)` — email = provided ?? auth user email → FIND_ACCOUNT. Never exposes/accepts a raw Appwrite userId from the client.
  - `linkGuardPay(input {email?})` — re-runs lookup server-side, upserts `guardpay_links`.
  - `unlinkGuardPay()` — deletes own link + syncs rows.
  - `syncWeekToGuardPay({periodId})` — verify period in own workplace **and `status==='published'`** → link exists → fetch own assignments + shift_types + holiday set → `buildWeekShifts` → IMPORT_WEEK → upsert `guardpay_syncs`.

Env vars (Vercel + `.env.local`, server-only): `GUARDPAY_APPWRITE_ENDPOINT`, `GUARDPAY_APPWRITE_PROJECT_ID`, `GUARDPAY_FUNCTION_ID` (=`697d0f3c001bba7f03d2`), `GUARDPAY_APPWRITE_API_KEY`, `GUARDPAY_IMPORT_SECRET`.

## Part D — משמרת UI (repo: AutoShiftSchedule)

**Branded design (user request): the GuardPay app icon is the visual anchor of the integration.**
- Asset: downscale `GuardPay/assets/images/icon.png` (1024×1024, 692KB) to an optimized ~128×128 PNG via `sips` → `AutoShiftSchedule/public/guardpay-icon.png` (a few KB). Never ship the 1024px original.
- The icon renders as an iOS-style app icon (rounded-squircle `border-radius`, subtle shadow via theme vars) inside the card — it IS the tap target in the unlinked state, inviting "tap the app icon to connect".

- `src/app/(employee)/me/schedule/GuardPaySyncCard.tsx` (client, ≤200 lines) — compact branded card under `WeekNav` in `.schedule-controls`, icon at the inline-start in all states:
  - not linked → tappable GuardPay icon + "חיבור ל-GuardPay" + hint "ייבוא המשמרות ישירות לאפליקציית השכר" → opens `GuardPayLinkFlow`
  - linked, not synced → icon + "ייבוא המשמרות ל-GuardPay" (useTransition, disabled while pending; disabled when employee has no shifts that week)
  - linked + synced → icon + badge "יובא ל-GuardPay ✓" + re-sync as **two-step inline confirm** (ClearAllButton idiom — `window.confirm` is banned); copy warns re-import replaces previously-imported shifts
  - small "ניתוק" text button with its own two-step confirm
- `src/app/(employee)/me/schedule/GuardPayLinkFlow.tsx` (client) — inline panel state machine: auto-lookup spinner → "נמצא חשבון על שם {name} — לקשר?" [קישור] [זה לא אני] → manual email input fallback (hint text mentions Apple private-relay address) → NO_PREFS / error states in Hebrew.
- Modify `src/app/(employee)/me/schedule/page.tsx` (131 lines now): two extra selects (`guardpay_links` by employee.id, `guardpay_syncs` by employee.id+selected period) + render `<GuardPaySyncCard/>` when `view` exists. Theme.css vars, RTL, logical props.

## Part E — One-time ops (user, documented in `utilities/README.md`)

1. Appwrite console → `shifts_history`: add optional attributes `import_source` (string 32), `import_key` (string 64); add index on `[user_id, import_key]` (required for queries) — create **before** redeploying.
2. Appwrite console → `utilities` function → env vars: add `TZ=Asia/Jerusalem`, `MISHMERET_SECRET=<generated strong secret>`.
3. Redeploy `utilities` (console upload as done today, or connect the GitHub repo for one-push redeploys).
4. Create API key "mishmeret-executor": scope `executions.write` **only** → for משמרת.
5. Set the five `GUARDPAY_*` vars in Vercel + `.env.local`.
6. `npx supabase db push`.

No new function is created — stays within the free-tier 2-function limit. Existing app behavior (local on-device salary computation, CALCULATE_* / DELETE_ACCOUNT actions) is unchanged.

## Testing

- **Vitest (TDD, write first)** — `build-week.test.ts`: summer/winter offsets, DST spring-forward + fall-back weeks, night 23:00+8h → next-day end, `m12_night` 19:00+12h, Friday + Motzei-Shabbat-into-Sunday shifts, holiday/erev-chag flag rules, `buildImportKey`. Plus `holiday-dates.test.ts`.
- **Function units** (`node --test`, mocked injected clients): secret/auth guard rejects (wrong secret, user-session header present), validation rejects, delete-then-create order + tag fields, NO_PREFS, BAD_TZ guard, and a doc-shape test asserting output keys exactly match the app's regular-shift doc fields + the 2 tag fields.
- **Playwright** `e2e/guardpay-sync.spec.ts` with `GUARDPAY_FAKE=1` in `playwright.config.ts` webServer env: publish week (reuse e2e/setup.ts helpers) → employee links (auto-match confirm) → sync → "יובא ✓" → re-sync two-step confirm. Port 3000 must be free (kill stale dev servers).
- **Manual verification with the user's real account**: link with real email; import a published week; open GuardPay → shifts appear via realtime; compare `total_amount` + hour buckets against an identical manually-added shift for: weekday morning, **Friday night**, cross-midnight night, chag if available; re-tap → no duplicates; manual GuardPay shift untouched by re-sync; monthly bruto sanity; verify existing app flows (add shift manually, monthly summary) still work after redeploy.

## Task order (small commits, each repo separate)

1. **GuardPay-Functions**: tests first for `find-account`/`import-week` (incl. secret + TZ guards); implement modules; wire into `main.js` (existing cases untouched).
2. **GuardPay-Functions**: README ops doc; user performs console steps (attributes, env vars, redeploy, executor key); curl smoke test (FIND_ACCOUNT own email, IMPORT_WEEK 1 shift, empty-array removal) — **includes the Friday-night bucket-parity check vs. a hand-added shift**, plus a sanity check that the app's existing actions still respond.
3. **AutoShiftSchedule**: migration + `db push`.
4. **AutoShiftSchedule**: validation + types; TDD `holiday-dates` → `build-week`.
5. **AutoShiftSchedule**: `lib/guardpay/appwrite.ts` (+ fake mode); env vars.
6. **AutoShiftSchedule**: `guardpay-actions.ts`.
7. **AutoShiftSchedule**: icon asset (`sips` downscale → `public/guardpay-icon.png`); `GuardPayLinkFlow.tsx`, `GuardPaySyncCard.tsx` (branded, icon-led); wire into `page.tsx`.
8. **AutoShiftSchedule**: e2e spec; `npm test`, `npm run build`, `npm run e2e` green.
9. **Both**: manual real-account verification; fix any bucket drift.

## Risks / notes

- **TZ mis-pricing is the #1 risk** — mitigated by env var + hard runtime guard on IMPORT_WEEK + Friday-night parity smoke test.
- **Touching a live function**: redeploying `utilities` affects the production app. Mitigation: existing `case` branches are byte-identical, new code is additive, unit tests cover the dispatcher, and the smoke test re-checks existing actions after deploy.
- `shifts_history` attribute requiredness (e.g. `comment`) unverified — the import writes the exact field set the app writes, so any schema accepting the app accepts the import; confirm in console during task 2.
- If the employee already logged the same week manually in GuardPay → parallel duplicates; v1 addresses via UI copy only (possible later: overlap warning).
- Unpublish-after-sync leaves imported shifts in GuardPay (button disappears with the published view). Documented edge.
- Employee edits an imported shift in GuardPay → re-sync overwrites (still tagged). Warned in confirm copy.
- Legacy hard-coded server key in `utilities/src/main.js` is committed to GitHub — recommend rotating + moving to env var (README note; actual rotation is the user's console action).
- Writing to GuardPay-Functions may require adding `/Users/tzachir/Desktop/MyApps/GuardPay-Functions` as a working directory at implementation time (user already approved changes there).

## Key reference files

- `GuardPay-Functions/utilities/src/main.js` — dispatcher to extend; `calculateShiftPay` at lines 230–386 (pay-parity source of truth, already server-side)
- `GuardPay/app/add-shift.jsx` — the exact doc field set the app writes (`handleSave`)
- `AutoShiftSchedule/src/app/(employee)/me/schedule/page.tsx` — UI integration point
- `AutoShiftSchedule/src/app/(employee)/me/requests/vacation-actions.ts` — server-action idiom
- `AutoShiftSchedule/src/lib/schedule/published-view.ts` — assignment/shift_types query shapes
- `AutoShiftSchedule/src/lib/holidays/israel.ts` — `israeliChagDates()`
