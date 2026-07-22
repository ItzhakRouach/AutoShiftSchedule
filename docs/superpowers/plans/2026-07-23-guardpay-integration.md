# GuardPay Weekly Shift Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An employee viewing their published week in משמרת taps one button and their shifts land in their GuardPay account with exact pay-bucket parity to the mobile app.

**Architecture:** Two repos. In `GuardPay-Functions` we extend the existing `utilities` Appwrite Function (free tier = 2 functions max, both used) with two secret-guarded actions: `FIND_ACCOUNT` (email → Appwrite user + name) and `IMPORT_WEEK` (full-week replace of tagged docs, priced by the function's own `calculateShiftPay`). In `AutoShiftSchedule` we add a link/sync data model (Supabase), a pure Israel-timezone payload builder (luxon), server actions, and a branded card on the employee schedule page.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS), Zod v4, luxon, @hebcal/core, node-appwrite v21 (function side), Vitest, Playwright, node:test.

**Spec:** `docs/superpowers/specs/2026-07-23-guardpay-integration-design.md`

## Global Constraints

- **Two repos**: AutoShiftSchedule = `/Users/tzachir/Desktop/MyApps/AutoShiftSchedule` (primary); GuardPay-Functions = `/Users/tzachir/Desktop/MyApps/GuardPay-Functions` (separate git repo — commit there separately). **Never touch `/Users/tzachir/Desktop/MyApps/GuardPay`** (the live mobile app).
- Appwrite constants: endpoint `https://fra.cloud.appwrite.io/v1`, project `69583540003a5151db86`, DB `695835c0002144f7a605`, collections `users_prefs` / `shifts_history`, function id `697d0f3c001bba7f03d2`.
- `shifts_history` field contract (GuardPay CLAUDE.md): NEVER rename/remove fields; only add optional fields. The two new optional attributes are `import_source` (string 32) and `import_key` (string 64).
- AutoShiftSchedule rules: every page/component file ≤200 lines; UI text Hebrew, RTL, logical CSS props; style via `theme.css` CSS vars (`var(--surface)`, `var(--accent)`, `var(--r-md)`…); `window.confirm` is banned (two-step inline confirm instead); mutations = Zod-validated `'use server'` actions returning `{ ok } | { error: string(Hebrew) }`.
- Timezone: salary math is LOCAL-time based. משמרת sends UTC instants built from Asia/Jerusalem wall-clock (luxon). The function must run with `TZ=Asia/Jerusalem`; `IMPORT_WEEK` refuses (`BAD_TZ`) when the offset probe fails.
- New actions are guarded by `MISHMERET_SECRET` (function env var) AND rejection of user-session invocations (`x-appwrite-user-id` header present ⇒ 401).
- Env vars in משמרת (server-only, Vercel + `.env.local`): `GUARDPAY_APPWRITE_ENDPOINT`, `GUARDPAY_APPWRITE_PROJECT_ID`, `GUARDPAY_FUNCTION_ID`, `GUARDPAY_APPWRITE_API_KEY`, `GUARDPAY_IMPORT_SECRET`. Missing envs must degrade gracefully (Hebrew error), never crash builds.
- `npm test`, `npm run build`, `npm run e2e` must stay green in AutoShiftSchedule. E2E needs port 3000 free (kill stale dev servers from other projects first).
- Commits: small, frequent, end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: GuardPay-Functions — auth guard + FIND_ACCOUNT module (TDD)

Repo: `/Users/tzachir/Desktop/MyApps/GuardPay-Functions`

**Files:**
- Create: `utilities/src/auth-guard.js`
- Create: `utilities/src/find-account.js`
- Create: `utilities/test/find-account.test.js`
- Modify: `utilities/package.json` (add test script)

**Interfaces:**
- Consumes: nothing (new modules; node-appwrite `Query` only).
- Produces: `mishmeretAuthorized(req, payload): boolean`; `findAccount({ users, databases }, payload): Promise<{ status: number, body: object }>` where success body is `{ ok: true, userId, name, email }` and failure bodies are `{ ok: false, code: 'BAD_PAYLOAD' | 'NOT_FOUND' | 'NO_PREFS' }`. Task 3 wires both into `main.js`; Task 8's fake fixtures mirror these bodies.

- [ ] **Step 1: Add the test script to `utilities/package.json`**

```json
{
  "name": "calculate-finance",
  "version": "1.0.0",
  "main": "src/main.js",
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  },
  "dependencies": {
    "node-appwrite": "^21.1.0"
  }
}
```

Run: `cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions/utilities && npm install`
Expected: node_modules created (needed so tests can import `node-appwrite`).

- [ ] **Step 2: Write the failing tests**

Create `utilities/test/find-account.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mishmeretAuthorized } from "../src/auth-guard.js";
import { findAccount } from "../src/find-account.js";

const SECRET = "test-secret";

function mockUsers(usersArr) {
  return { list: async () => ({ total: usersArr.length, users: usersArr }) };
}
function mockDatabases(prefsDocs) {
  return {
    listDocuments: async () => ({ total: prefsDocs.length, documents: prefsDocs }),
  };
}

test("mishmeretAuthorized: true only with matching secret and no user session", () => {
  process.env.MISHMERET_SECRET = SECRET;
  assert.equal(mishmeretAuthorized({ headers: {} }, { secret: SECRET }), true);
  assert.equal(mishmeretAuthorized({ headers: {} }, { secret: "wrong" }), false);
  assert.equal(mishmeretAuthorized({ headers: {} }, {}), false);
  // App-user execution (session header present) is always rejected.
  assert.equal(
    mishmeretAuthorized({ headers: { "x-appwrite-user-id": "u1" } }, { secret: SECRET }),
    false,
  );
  // Unset secret on the function ⇒ nothing is authorized.
  delete process.env.MISHMERET_SECRET;
  assert.equal(mishmeretAuthorized({ headers: {} }, { secret: "" }), false);
  process.env.MISHMERET_SECRET = SECRET;
});

test("findAccount: bad email → BAD_PAYLOAD 400", async () => {
  const out = await findAccount({ users: mockUsers([]), databases: mockDatabases([]) }, { email: "not-an-email" });
  assert.equal(out.status, 400);
  assert.equal(out.body.code, "BAD_PAYLOAD");
});

test("findAccount: no matching user → NOT_FOUND 404", async () => {
  const out = await findAccount({ users: mockUsers([]), databases: mockDatabases([]) }, { email: "a@b.com" });
  assert.equal(out.status, 404);
  assert.equal(out.body.code, "NOT_FOUND");
});

test("findAccount: user without prefs → NO_PREFS 404", async () => {
  const out = await findAccount(
    { users: mockUsers([{ $id: "u1", email: "a@b.com", name: "A" }]), databases: mockDatabases([]) },
    { email: "a@b.com" },
  );
  assert.equal(out.status, 404);
  assert.equal(out.body.code, "NO_PREFS");
});

test("findAccount: success returns userId + prefs name, email normalized", async () => {
  const out = await findAccount(
    {
      users: mockUsers([{ $id: "u1", email: "a@b.com", name: "auth-name" }]),
      databases: mockDatabases([{ user_name: "יצחק רואש" }]),
    },
    { email: "  A@B.com " },
  );
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { ok: true, userId: "u1", name: "יצחק רואש", email: "a@b.com" });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions/utilities && npm test`
Expected: FAIL — `Cannot find module '../src/auth-guard.js'`.

- [ ] **Step 4: Implement `utilities/src/auth-guard.js`**

```js
/** מִשְׁמֶרֶת-only actions gate. These actions are server-to-server: the app
 *  never calls them, and IMPORT_WEEK writes to an arbitrary user_id — so a
 *  user-session execution (x-appwrite-user-id header) is always rejected. */
export function mishmeretAuthorized(req, payload) {
  return (
    !!process.env.MISHMERET_SECRET &&
    payload?.secret === process.env.MISHMERET_SECRET &&
    !req?.headers?.["x-appwrite-user-id"]
  );
}
```

- [ ] **Step 5: Implement `utilities/src/find-account.js`**

```js
import { Query } from "node-appwrite";

const DB_ID = process.env.APPWRITE_DB_ID ?? "695835c0002144f7a605";
const USERS_PREFS = "users_prefs";

/** FIND_ACCOUNT: locate a GuardPay Appwrite user by email; return the display
 *  name (from users_prefs) for מִשְׁמֶרֶת's link-confirmation step. */
export async function findAccount({ users, databases }, payload) {
  const email = String(payload?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { status: 400, body: { ok: false, code: "BAD_PAYLOAD" } };
  }

  const list = await users.list([Query.equal("email", email), Query.limit(1)]);
  const user = list.users?.[0];
  if (!user) return { status: 404, body: { ok: false, code: "NOT_FOUND" } };

  const prefsRes = await databases.listDocuments(DB_ID, USERS_PREFS, [
    Query.equal("user_id", user.$id),
    Query.limit(1),
  ]);
  const prefs = prefsRes.documents?.[0];
  if (!prefs) return { status: 404, body: { ok: false, code: "NO_PREFS" } };

  return {
    status: 200,
    body: { ok: true, userId: user.$id, name: prefs.user_name || user.name || email, email: user.email },
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions/utilities && npm test`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit (GuardPay-Functions repo)**

```bash
cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions
git add utilities/package.json utilities/src/auth-guard.js utilities/src/find-account.js utilities/test/find-account.test.js
git commit -m "feat(utilities): mishmeret auth guard + FIND_ACCOUNT action module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: GuardPay-Functions — IMPORT_WEEK module (TDD)

Repo: `/Users/tzachir/Desktop/MyApps/GuardPay-Functions`

**Files:**
- Create: `utilities/src/import-week.js`
- Create: `utilities/test/import-week.test.js`

**Interfaces:**
- Consumes: `calculateShiftPay(startISO, endISO, baseRate, travelRate, isHoliday)` — already defined in `utilities/src/main.js` (lines 230–386), injected as a dependency.
- Produces: `tzGuardOk(): boolean`; `validateImportPayload(payload): string | null`; `importWeek({ databases, calculateShiftPay }, payload): Promise<{ status, body }>` — success body `{ ok: true, deleted, created, totalAmount }`; failures `{ ok: false, code: 'BAD_TZ' | 'BAD_PAYLOAD' | 'NO_PREFS' }`. Payload shape (Task 8/9 must match): `{ secret, userId, importKey: "mishmeret:YYYY-MM-DD", shifts: [{ start, end, isHoliday, comment }] }`.

- [ ] **Step 1: Write the failing tests**

Create `utilities/test/import-week.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { tzGuardOk, validateImportPayload, importWeek } from "../src/import-week.js";

// A tiny stand-in for main.js's calculateShiftPay — importWeek only relies on
// its return being the pay-bucket object (it adds identity fields itself).
function fakeCalc() {
  return {
    total_amount: 500, reg_hours: 8, extra_hours: 0,
    reg_pay_amount: 500, extra_pay_amount: 0, travel_pay_amount: 0,
    h100_hours: 8, h125_extra_hours: 0, h150_extra_hours: 0,
    h175_extra_hours: 0, h200_extra_hours: 0, h150_shabat: 0,
    h150_holiday: 0, h175_holiday: 0, h200_holiday: 0,
  };
}

function mockDb({ prefs = [{ price_per_hour: 45, price_per_ride: 20 }], existing = [] } = {}) {
  const calls = { created: [], deleted: [] };
  const db = {
    listDocuments: async (_d, col) =>
      col === "users_prefs"
        ? { total: prefs.length, documents: prefs }
        : { total: existing.length, documents: existing },
    deleteDocument: async (_d, _c, id) => { calls.deleted.push(id); },
    createDocument: async (_d, _c, _id, doc) => { calls.created.push(doc); },
  };
  return { db, calls };
}

const VALID = {
  userId: "u1",
  importKey: "mishmeret:2026-07-19",
  shifts: [
    { start: "2026-07-19T04:00:00.000Z", end: "2026-07-19T12:00:00.000Z", isHoliday: false, comment: "יובא ממשמרת · בוקר" },
  ],
};

test("tzGuardOk true under Asia/Jerusalem, false under UTC", () => {
  const prev = process.env.TZ;
  process.env.TZ = "Asia/Jerusalem";
  assert.equal(tzGuardOk(), true);
  process.env.TZ = "UTC";
  assert.equal(tzGuardOk(), false);
  process.env.TZ = prev ?? "Asia/Jerusalem";
});

test("validateImportPayload rejects bad shapes", () => {
  assert.equal(validateImportPayload(VALID), null);
  assert.notEqual(validateImportPayload({ ...VALID, userId: "" }), null);
  assert.notEqual(validateImportPayload({ ...VALID, importKey: "week-1" }), null);
  assert.notEqual(validateImportPayload({ ...VALID, shifts: new Array(21).fill(VALID.shifts[0]) }), null);
  // end before start
  assert.notEqual(
    validateImportPayload({ ...VALID, shifts: [{ ...VALID.shifts[0], end: "2026-07-19T03:00:00.000Z" }] }),
    null,
  );
  // span > 24h
  assert.notEqual(
    validateImportPayload({ ...VALID, shifts: [{ ...VALID.shifts[0], end: "2026-07-20T05:00:00.000Z" }] }),
    null,
  );
  // empty array is VALID — it means "remove this week's import"
  assert.equal(validateImportPayload({ ...VALID, shifts: [] }), null);
});

test("importWeek: missing prefs → NO_PREFS", async () => {
  const { db } = mockDb({ prefs: [] });
  const out = await importWeek({ databases: db, calculateShiftPay: fakeCalc }, VALID);
  assert.equal(out.status, 404);
  assert.equal(out.body.code, "NO_PREFS");
});

test("importWeek: deletes existing tagged docs then creates new ones with tags", async () => {
  const { db, calls } = mockDb({ existing: [{ $id: "old1" }, { $id: "old2" }] });
  const out = await importWeek({ databases: db, calculateShiftPay: fakeCalc }, VALID);
  assert.equal(out.status, 200);
  assert.deepEqual(calls.deleted, ["old1", "old2"]);
  assert.equal(calls.created.length, 1);
  const doc = calls.created[0];
  // Exact regular-shift field set add-shift.jsx writes + the two tags:
  assert.equal(doc.user_id, "u1");
  assert.equal(doc.start_time, VALID.shifts[0].start);
  assert.equal(doc.end_time, VALID.shifts[0].end);
  assert.equal(doc.base_rate, 45);
  assert.equal(doc.is_training, false);
  assert.equal(doc.is_vacation, false);
  assert.equal(doc.is_holiday, false);
  assert.equal(doc.comment, "יובא ממשמרת · בוקר");
  assert.equal(doc.import_source, "mishmeret");
  assert.equal(doc.import_key, "mishmeret:2026-07-19");
  for (const k of ["total_amount","reg_hours","extra_hours","reg_pay_amount","extra_pay_amount","travel_pay_amount","h100_hours","h125_extra_hours","h150_extra_hours","h175_extra_hours","h200_extra_hours","h150_shabat","h150_holiday","h175_holiday","h200_holiday"]) {
    assert.ok(k in doc, `missing pay bucket ${k}`);
  }
  assert.deepEqual(out.body, { ok: true, deleted: 2, created: 1, totalAmount: 500 });
});

test("importWeek: empty shifts array removes the week's import", async () => {
  const { db, calls } = mockDb({ existing: [{ $id: "old1" }] });
  const out = await importWeek({ databases: db, calculateShiftPay: fakeCalc }, { ...VALID, shifts: [] });
  assert.equal(out.status, 200);
  assert.deepEqual(calls.deleted, ["old1"]);
  assert.equal(calls.created.length, 0);
  assert.equal(out.body.created, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions/utilities && npm test`
Expected: FAIL — `Cannot find module '../src/import-week.js'` (find-account tests still pass).

- [ ] **Step 3: Implement `utilities/src/import-week.js`**

```js
import { ID, Query } from "node-appwrite";

// salaryLogic prices by LOCAL wall-clock (getHours/getDay). Identical to the
// phone app only when this process runs in Israel time. Set defensively here;
// the console env var TZ=Asia/Jerusalem is the primary mechanism.
process.env.TZ ??= "Asia/Jerusalem";

const DB_ID = process.env.APPWRITE_DB_ID ?? "695835c0002144f7a605";
const SHIFTS_HISTORY = "shifts_history";
const USERS_PREFS = "users_prefs";
const IMPORT_KEY_RE = /^mishmeret:\d{4}-\d{2}-\d{2}$/;
const MAX_SHIFTS = 20;
const MAX_SPAN_MS = 24 * 60 * 60 * 1000;

/** Refuse to price under a wrong timezone — a UTC process would silently
 *  mis-bucket Shabbat/night hours. Probes both DST sides of Israel time. */
export function tzGuardOk() {
  const winter = new Date("2026-01-15T00:00:00Z").getTimezoneOffset();
  const summer = new Date("2026-07-15T00:00:00Z").getTimezoneOffset();
  return winter === -120 && summer === -180;
}

/** Returns null when valid, or a short reason string. */
export function validateImportPayload(payload) {
  if (!payload || typeof payload.userId !== "string" || !payload.userId) return "userId";
  if (typeof payload.importKey !== "string" || !IMPORT_KEY_RE.test(payload.importKey)) return "importKey";
  if (!Array.isArray(payload.shifts) || payload.shifts.length > MAX_SHIFTS) return "shifts";
  for (const s of payload.shifts) {
    const start = new Date(s?.start ?? "");
    const end = new Date(s?.end ?? "");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "shift dates";
    if (end <= start || end - start > MAX_SPAN_MS) return "shift span";
  }
  return null;
}

/** Full-week sync: replace ONLY docs this integration created for this week
 *  (matched by user_id + import_key). Manually-added shifts are never touched. */
export async function importWeek({ databases, calculateShiftPay }, payload) {
  if (!tzGuardOk()) {
    return { status: 500, body: { ok: false, code: "BAD_TZ", message: "function TZ must be Asia/Jerusalem" } };
  }
  const invalid = validateImportPayload(payload);
  if (invalid) return { status: 400, body: { ok: false, code: "BAD_PAYLOAD", message: invalid } };

  const prefsRes = await databases.listDocuments(DB_ID, USERS_PREFS, [
    Query.equal("user_id", payload.userId),
    Query.limit(1),
  ]);
  const prefs = prefsRes.documents?.[0];
  if (!prefs) return { status: 404, body: { ok: false, code: "NO_PREFS" } };
  const baseRate = Number(prefs.price_per_hour);
  const travelRate = Number(prefs.price_per_ride || 0);

  const existing = await databases.listDocuments(DB_ID, SHIFTS_HISTORY, [
    Query.equal("user_id", payload.userId),
    Query.equal("import_key", payload.importKey),
    Query.limit(100),
  ]);
  for (const doc of existing.documents) {
    await databases.deleteDocument(DB_ID, SHIFTS_HISTORY, doc.$id);
  }

  let totalAmount = 0;
  for (const s of payload.shifts) {
    // Same doc shape add-shift.jsx writes for a regular shift, plus the 2 tags.
    const doc = calculateShiftPay(s.start, s.end, baseRate, travelRate, !!s.isHoliday);
    doc.is_training = false;
    doc.is_vacation = false;
    doc.start_time = s.start;
    doc.end_time = s.end;
    doc.base_rate = baseRate;
    doc.is_holiday = !!s.isHoliday;
    doc.user_id = payload.userId;
    doc.comment = String(s.comment ?? "").slice(0, 200);
    doc.import_source = "mishmeret";
    doc.import_key = payload.importKey;
    await databases.createDocument(DB_ID, SHIFTS_HISTORY, ID.unique(), doc);
    totalAmount += doc.total_amount;
  }

  return {
    status: 200,
    body: { ok: true, deleted: existing.documents.length, created: payload.shifts.length, totalAmount: Number(totalAmount.toFixed(2)) },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions/utilities && npm test`
Expected: PASS (all tests, both files).

- [ ] **Step 5: Commit (GuardPay-Functions repo)**

```bash
cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions
git add utilities/src/import-week.js utilities/test/import-week.test.js
git commit -m "feat(utilities): IMPORT_WEEK action module — full-week tagged replace with TZ guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: GuardPay-Functions — wire dispatcher, README, deploy + smoke (user gate)

Repo: `/Users/tzachir/Desktop/MyApps/GuardPay-Functions`

**Files:**
- Modify: `utilities/src/main.js` (imports at top; two `case` branches before `default:` at line ~152)
- Create: `utilities/README.md`

**Interfaces:**
- Consumes: `mishmeretAuthorized`, `findAccount`, `importWeek` (Tasks 1–2); in-file `calculateShiftPay`.
- Produces: the deployed function accepts `{ action: "FIND_ACCOUNT" | "IMPORT_WEEK", payload: { secret, ... } }` — the contract Task 8 calls over REST.

- [ ] **Step 1: Modify `utilities/src/main.js` — add imports (top of file)**

Replace line 1 with:

```js
import { Client, Databases, Query, Users } from "node-appwrite";
import { mishmeretAuthorized } from "./auth-guard.js";
import { findAccount } from "./find-account.js";
import { importWeek } from "./import-week.js";
```

- [ ] **Step 2: Add the two cases before `default:` (currently line ~152)**

Insert inside the `switch (action)`, after the `CALCULATE_SHIFT` case's closing brace:

```js
      // ── מִשְׁמֶרֶת (AutoShiftSchedule) integration — server-to-server only ──
      case "FIND_ACCOUNT":
      case "IMPORT_WEEK": {
        if (!mishmeretAuthorized(req, payload)) {
          return res.json({ ok: false, code: "UNAUTHORIZED" }, 401);
        }
        const out =
          action === "FIND_ACCOUNT"
            ? await findAccount({ users, databases }, payload)
            : await importWeek({ databases, calculateShiftPay }, payload);
        return res.json(out.body, out.status);
      }
```

Do NOT touch the existing `DELETE_ACCOUNT` / `CALCULATE_SALARY` / `CALCULATE_SHIFT` cases or the helper functions.

- [ ] **Step 3: Run tests + syntax check**

Run: `cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions/utilities && npm test && node --check src/main.js`
Expected: tests PASS; `node --check` silent (exit 0).

- [ ] **Step 4: Write `utilities/README.md` (ops checklist)**

```markdown
# utilities (calculate-finance) — Appwrite Function

Action-dispatched function (`{ action, payload }`). Actions:
- `CALCULATE_SALARY`, `CALCULATE_SHIFT` — legacy salary math (app computes locally now).
- `DELETE_ACCOUNT` — user-session gated account wipe.
- `FIND_ACCOUNT`, `IMPORT_WEEK` — מִשְׁמֶרֶת (AutoShiftSchedule) integration, gated by
  the `MISHMERET_SECRET` env var. Never callable from a user session.

## One-time console setup for the מִשְׁמֶרֶת integration

1. **shifts_history attributes** (Databases → shifts_history → Attributes):
   - `import_source` — String, size 32, optional (no default)
   - `import_key`   — String, size 64, optional (no default)
   Then add a **key index** on `[user_id, import_key]` (Indexes tab) — queries
   on these attributes fail without it. Wait for both attributes + index to be
   "available" before deploying.
2. **Function env vars** (Functions → utilities → Settings → Variables):
   - `TZ` = `Asia/Jerusalem`   (salary math is local-time based — REQUIRED)
   - `MISHMERET_SECRET` = a long random string, e.g. `openssl rand -hex 32`
   - `APPWRITE_DB_ID` = `695835c0002144f7a605`
3. **Redeploy** this function (console upload of `utilities/`, or Git integration).
4. **Executor API key for מִשְׁמֶרֶת** (Overview → Integrations → API keys):
   name `mishmeret-executor`, scope **executions.write only**.
5. Hand מִשְׁמֶרֶת (Vercel + .env.local): endpoint, project id, this function's id,
   the executor key, and `MISHMERET_SECRET`.

## Smoke test (after deploy)

```bash
# FIND_ACCOUNT (expect ok:true with your name)
curl -s -X POST "https://fra.cloud.appwrite.io/v1/functions/697d0f3c001bba7f03d2/executions" \
  -H "X-Appwrite-Project: 69583540003a5151db86" \
  -H "X-Appwrite-Key: <EXECUTOR_KEY>" -H "content-type: application/json" \
  -d '{"body":"{\"action\":\"FIND_ACCOUNT\",\"payload\":{\"secret\":\"<MISHMERET_SECRET>\",\"email\":\"<your-guardpay-email>\"}}","async":false,"method":"POST","path":"/"}'
# IMPORT_WEEK with one Friday-night shift (expect ok:true, created:1), then
# compare total_amount + buckets against the SAME shift added by hand in the app.
# Wrong secret (expect 401 UNAUTHORIZED in responseBody):
# ...same call with "secret":"nope"
# Existing actions still alive: CALCULATE_SHIFT with a weekday morning payload.
```

Note: the hard-coded server API key in `src/main.js` predates this work and is
committed to Git — rotate it and move it to an env var when possible.
```

- [ ] **Step 5: Commit (GuardPay-Functions repo)**

```bash
cd /Users/tzachir/Desktop/MyApps/GuardPay-Functions
git add utilities/src/main.js utilities/README.md
git commit -m "feat(utilities): dispatch FIND_ACCOUNT + IMPORT_WEEK with shared-secret gate; ops README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: USER GATE — console setup + deploy + smoke**

Pause and ask the user to perform README steps 1–4 (attributes, env vars, redeploy, executor key), then run the smoke tests together. **Must verify before continuing to Task 8's real mode:**
1. `FIND_ACCOUNT` with the user's real email returns `ok:true` + correct name. If Appwrite rejects `Query.equal("email", …)` on the Users list, switch `findAccount` to the search fallback `users.list([], email)` and match `user.email === email` exactly — then re-test.
2. `IMPORT_WEEK` with one **Friday 23:00→07:00** shift: doc appears in the GuardPay app instantly; `total_amount` and hour buckets equal a hand-added identical shift (then delete both test shifts via re-import with `shifts: []` + manual delete).
3. Wrong secret → 401 `UNAUTHORIZED`.
4. Existing `CALCULATE_SHIFT` action still responds (app regression check).

Record the function's five values for Task 8's `.env.local`.

---

### Task 4: AutoShiftSchedule — Supabase migration (link + sync tables)

Repo: `/Users/tzachir/Desktop/MyApps/AutoShiftSchedule` (all remaining tasks)

**Files:**
- Create: `supabase/migrations/20260723000001_guardpay_links.sql`

**Interfaces:**
- Produces: tables `guardpay_links` (one per employee) and `guardpay_syncs` (one per employee×period) with self-only RLS — read in Tasks 9–10.

- [ ] **Step 1: Write the migration**

```sql
-- 20260723000001_guardpay_links.sql — GuardPay (external salary app) integration.
-- guardpay_links: one row per employee — their linked GuardPay (Appwrite) account.
-- guardpay_syncs: one row per employee×period — "this week was imported" marker.
-- Self-only RLS: the employee owns both; managers have no access (wage privacy).

create table if not exists guardpay_links (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null unique references employees(id) on delete cascade,
  guardpay_user_id text not null,
  guardpay_email   text not null,
  guardpay_name    text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists guardpay_syncs (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  period_id   uuid not null references schedule_periods(id) on delete cascade,
  synced_at   timestamptz not null default now(),
  shift_count smallint not null default 0,
  unique (employee_id, period_id)
);
create index if not exists guardpay_syncs_employee_idx on guardpay_syncs(employee_id);

alter table guardpay_links enable row level security;
alter table guardpay_syncs enable row level security;

create policy guardpay_links_self on guardpay_links
  for all
  using (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()))
  with check (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()));

create policy guardpay_syncs_self on guardpay_syncs
  for all
  using (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()))
  with check (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()));
```

- [ ] **Step 2: Apply to the linked cloud project**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx supabase db push`
Expected: `Applying migration 20260723000001_guardpay_links.sql... Finished`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723000001_guardpay_links.sql
git commit -m "feat(db): guardpay_links + guardpay_syncs tables with self-only RLS

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Validation schemas + types/error map

**Files:**
- Create: `src/lib/validation/guardpay.ts`
- Create: `src/lib/guardpay/types.ts`

**Interfaces:**
- Produces: `findAccountSchema` (`{ email?: string }`), `syncWeekSchema` (`{ periodId: uuid }`); types `GuardPayShift`, `FindAccountOk`, `ImportWeekOk`, `GuardPayErrorCode`, map `GUARDPAY_ERROR_HE`. Consumed by Tasks 8–9.

- [ ] **Step 1: Create `src/lib/validation/guardpay.ts`**

```ts
import { z } from 'zod'

/** Optional manual email for the GuardPay link flow (auto-match uses the
 *  authenticated user's email when omitted). */
export const findAccountSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'כתובת אימייל לא תקינה' }).optional(),
})

export const syncWeekSchema = z.object({
  periodId: z.string().uuid({ message: 'מזהה שבוע לא תקין' }),
})

export type FindAccountInput = z.infer<typeof findAccountSchema>
export type SyncWeekInput = z.infer<typeof syncWeekSchema>
```

- [ ] **Step 2: Create `src/lib/guardpay/types.ts`**

```ts
/** One shift in the IMPORT_WEEK payload — UTC instants built from Israel wall-clock. */
export interface GuardPayShift {
  start: string
  end: string
  isHoliday: boolean
  comment: string
}

export interface FindAccountOk {
  ok: true
  userId: string
  name: string
  email: string
}

export interface ImportWeekOk {
  ok: true
  deleted: number
  created: number
  totalAmount: number
}

export type GuardPayErrorCode =
  | 'NOT_FOUND'
  | 'NO_PREFS'
  | 'BAD_PAYLOAD'
  | 'UNAUTHORIZED'
  | 'BAD_TZ'
  | 'EXEC_FAILED'

export const GUARDPAY_ERROR_HE: Record<GuardPayErrorCode, string> = {
  NOT_FOUND: 'לא נמצא חשבון GuardPay עם האימייל הזה',
  NO_PREFS: 'החשבון נמצא, אבל ההגדרה הראשונית באפליקציית GuardPay לא הושלמה',
  BAD_PAYLOAD: 'שגיאה בנתוני הייבוא',
  UNAUTHORIZED: 'שגיאת הרשאה מול GuardPay',
  BAD_TZ: 'שגיאת תצורה בשרת GuardPay (אזור זמן)',
  EXEC_FAILED: 'החיבור ל-GuardPay נכשל, נסו שוב מאוחר יותר',
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/lib/validation/guardpay.ts src/lib/guardpay/types.ts
git commit -m "feat(guardpay): validation schemas, payload types, Hebrew error map

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: holiday-dates (TDD)

**Files:**
- Create: `src/lib/guardpay/holiday-dates.test.ts`
- Create: `src/lib/guardpay/holiday-dates.ts`

**Interfaces:**
- Consumes: `israeliChagDates(gregYear): ChagDate[]` from `src/lib/holidays/israel.ts`.
- Produces: pure `unionHolidaySet(tableDates: string[], years: number[]): Set<string>`; loader `collectHolidayDates(supabase, workplaceId, weekStart): Promise<Set<string>>` (queries the `holidays` table for weekStart..weekStart+7). Consumed by Task 9.

- [ ] **Step 1: Write the failing test**

Create `src/lib/guardpay/holiday-dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { unionHolidaySet, weekYears } from './holiday-dates'
import { israeliChagDates } from '@/lib/holidays/israel'

describe('unionHolidaySet', () => {
  it('contains every workplace-table date', () => {
    const set = unionHolidaySet(['2026-07-20', '2026-07-24'], [2026])
    expect(set.has('2026-07-20')).toBe(true)
    expect(set.has('2026-07-24')).toBe(true)
  })

  it('contains every hebcal chag date for the given years', () => {
    const set = unionHolidaySet([], [2026])
    const chagim = israeliChagDates(2026)
    expect(chagim.length).toBeGreaterThan(0)
    for (const c of chagim) expect(set.has(c.date)).toBe(true)
  })

  it('does not invent dates', () => {
    const set = unionHolidaySet([], [2026])
    expect(set.has('2026-07-22')).toBe(false) // ordinary Wednesday
  })
})

describe('weekYears', () => {
  it('single year for a mid-year week', () => {
    expect(weekYears('2026-07-19')).toEqual([2026])
  })
  it('both years when the week crosses new year (covers weekStart..+7)', () => {
    expect(weekYears('2026-12-27')).toEqual([2026, 2027])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/guardpay/holiday-dates.test.ts`
Expected: FAIL — cannot resolve `./holiday-dates`.

- [ ] **Step 3: Implement `src/lib/guardpay/holiday-dates.ts`**

```ts
/**
 * Holiday-date set for the GuardPay import: a shift on one of these civil dates
 * (or starting ≥16:00 on the eve of one) gets is_holiday=true and is paid like
 * Shabbat by GuardPay's salary logic. Union of the workplace's own `holidays`
 * table and the national chag list from @hebcal/core.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { israeliChagDates } from '@/lib/holidays/israel'

/** Gregorian years covered by weekStart..weekStart+7 (8 dates — the extra day
 *  covers a Saturday-night shift spilling into the next Sunday). */
export function weekYears(weekStart: string): number[] {
  const start = DateTime.fromISO(weekStart)
  const end = start.plus({ days: 7 })
  return start.year === end.year ? [start.year] : [start.year, end.year]
}

export function unionHolidaySet(tableDates: string[], years: number[]): Set<string> {
  const set = new Set<string>(tableDates)
  for (const y of years) for (const c of israeliChagDates(y)) set.add(c.date)
  return set
}

/** Loads the workplace holiday rows for the week window and unions with hebcal. */
export async function collectHolidayDates(
  supabase: SupabaseClient,
  workplaceId: string,
  weekStart: string,
): Promise<Set<string>> {
  const weekEnd = DateTime.fromISO(weekStart).plus({ days: 7 }).toISODate()!
  const { data } = await supabase
    .from('holidays')
    .select('date')
    .eq('workplace_id', workplaceId)
    .gte('date', weekStart)
    .lte('date', weekEnd)
  const tableDates = (data ?? []).map((r) => r.date as string)
  return unionHolidaySet(tableDates, weekYears(weekStart))
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/guardpay/holiday-dates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/guardpay/holiday-dates.ts src/lib/guardpay/holiday-dates.test.ts
git commit -m "feat(guardpay): holiday-date set (workplace table ∪ hebcal chagim)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: build-week payload builder (TDD — the correctness core)

**Files:**
- Create: `src/lib/guardpay/build-week.test.ts`
- Create: `src/lib/guardpay/build-week.ts`

**Interfaces:**
- Consumes: luxon `DateTime`; `GuardPayShift` from Task 5.
- Produces: `buildImportKey(weekStart: string): string`; `buildWeekShifts(args: { weekStart: string; assignments: { day_of_week: number; shift_type_id: string }[]; shiftTypesById: Record<string, { id: string; name: string; start_hour: number; hours: number }>; holidaySet: Set<string> }): GuardPayShift[]`. Consumed by Task 9.

Key facts baked into the tests: week_start_date is a Sunday; `day_of_week` 0=Sunday..6=Saturday; shift times come from the workplace's `shift_types` rows (whole hours); Israel DST 2026: +03:00 from Fri 2026-03-27 through Sat 2026-10-24, +02:00 otherwise.

- [ ] **Step 1: Write the failing test**

Create `src/lib/guardpay/build-week.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildImportKey, buildWeekShifts } from './build-week'

const TYPES = {
  morning: { id: 'morning', name: 'בוקר', start_hour: 7, hours: 8 },
  noon: { id: 'noon', name: 'צהריים', start_hour: 15, hours: 8 },
  night: { id: 'night', name: 'לילה', start_hour: 23, hours: 8 },
  m12night: { id: 'm12night', name: 'לילה 12ש׳', start_hour: 19, hours: 12 },
}

function build(weekStart: string, assignments: { day_of_week: number; shift_type_id: string }[], holidays: string[] = []) {
  return buildWeekShifts({ weekStart, assignments, shiftTypesById: TYPES, holidaySet: new Set(holidays) })
}

describe('buildImportKey', () => {
  it('is stable per week', () => {
    expect(buildImportKey('2026-07-19')).toBe('mishmeret:2026-07-19')
  })
})

describe('buildWeekShifts — Israel timezone correctness', () => {
  it('summer (+03:00): Sunday morning 07:00 → 04:00Z', () => {
    const [s] = build('2026-07-19', [{ day_of_week: 0, shift_type_id: 'morning' }])
    expect(s.start).toBe('2026-07-19T04:00:00.000Z')
    expect(s.end).toBe('2026-07-19T12:00:00.000Z')
  })

  it('winter (+02:00): Sunday morning 07:00 → 05:00Z', () => {
    const [s] = build('2026-01-18', [{ day_of_week: 0, shift_type_id: 'morning' }])
    expect(s.start).toBe('2026-01-18T05:00:00.000Z')
    expect(s.end).toBe('2026-01-18T13:00:00.000Z')
  })

  it('DST spring-forward week (starts Fri 2026-03-27): Thu is +02, Fri is +03', () => {
    const shifts = build('2026-03-22', [
      { day_of_week: 4, shift_type_id: 'morning' }, // Thu 2026-03-26
      { day_of_week: 5, shift_type_id: 'morning' }, // Fri 2026-03-27 (DST began 02:00)
    ])
    expect(shifts[0].start).toBe('2026-03-26T05:00:00.000Z')
    expect(shifts[1].start).toBe('2026-03-27T04:00:00.000Z')
  })

  it('DST fall-back: Sun 2026-10-25 is already +02', () => {
    const [s] = build('2026-10-25', [{ day_of_week: 0, shift_type_id: 'morning' }])
    expect(s.start).toBe('2026-10-25T05:00:00.000Z')
  })

  it('night shift crosses midnight: end lands on the next civil day', () => {
    const [s] = build('2026-07-19', [{ day_of_week: 0, shift_type_id: 'night' }])
    expect(s.start).toBe('2026-07-19T20:00:00.000Z') // 23:00+03:00
    expect(s.end).toBe('2026-07-20T04:00:00.000Z') // 07:00 next day
  })

  it('12h night 19:00+12h → 07:00 next day', () => {
    const [s] = build('2026-07-19', [{ day_of_week: 2, shift_type_id: 'm12night' }])
    expect(s.start).toBe('2026-07-21T16:00:00.000Z')
    expect(s.end).toBe('2026-07-22T04:00:00.000Z')
  })
})

describe('buildWeekShifts — holidays, comments, ordering', () => {
  it('holiday date flags the shift; ordinary date does not', () => {
    const shifts = build(
      '2026-07-19',
      [
        { day_of_week: 1, shift_type_id: 'morning' }, // 2026-07-20 (holiday below)
        { day_of_week: 2, shift_type_id: 'morning' },
      ],
      ['2026-07-20'],
    )
    expect(shifts[0].isHoliday).toBe(true)
    expect(shifts[1].isHoliday).toBe(false)
  })

  it('erev-chag: a shift starting ≥16:00 the day BEFORE a holiday is flagged', () => {
    const shifts = build(
      '2026-07-19',
      [
        { day_of_week: 1, shift_type_id: 'noon' }, // starts 15:00 on erev chag → NOT flagged
        { day_of_week: 1, shift_type_id: 'night' }, // starts 23:00 on erev chag → flagged
      ],
      ['2026-07-21'],
    )
    expect(shifts.find((s) => s.comment.includes('צהריים'))!.isHoliday).toBe(false)
    expect(shifts.find((s) => s.comment.includes('לילה'))!.isHoliday).toBe(true)
  })

  it('comment carries the shift-type name; unknown shift types are skipped; output sorted by start', () => {
    const shifts = build('2026-07-19', [
      { day_of_week: 3, shift_type_id: 'noon' },
      { day_of_week: 0, shift_type_id: 'morning' },
      { day_of_week: 1, shift_type_id: 'ghost-type' },
    ])
    expect(shifts).toHaveLength(2)
    expect(shifts[0].comment).toBe('יובא ממשמרת · בוקר')
    expect(shifts[0].start < shifts[1].start).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/guardpay/build-week.test.ts`
Expected: FAIL — cannot resolve `./build-week`.

- [ ] **Step 3: Implement `src/lib/guardpay/build-week.ts`**

```ts
/**
 * Pure builder: published-week assignments → GuardPay IMPORT_WEEK shifts.
 * All wall-clock math happens in Asia/Jerusalem (luxon handles DST), and the
 * payload carries true UTC instants — the same format the GuardPay app itself
 * stores (`Date.toISOString()`), so its salary logic prices them identically.
 */
import { DateTime } from 'luxon'
import type { GuardPayShift } from './types'

const ZONE = 'Asia/Jerusalem'

export interface AssignmentRow {
  day_of_week: number
  shift_type_id: string
}

export interface ShiftTypeRow {
  id: string
  name: string
  start_hour: number
  hours: number
}

/** Stable idempotency key: re-importing the same week replaces, never duplicates. */
export function buildImportKey(weekStart: string): string {
  return `mishmeret:${weekStart}`
}

function dateOfDay(weekStart: string, dayOfWeek: number): DateTime {
  return DateTime.fromISO(weekStart, { zone: ZONE }).plus({ days: dayOfWeek })
}

export function buildWeekShifts(args: {
  weekStart: string
  assignments: AssignmentRow[]
  shiftTypesById: Record<string, ShiftTypeRow>
  holidaySet: Set<string>
}): GuardPayShift[] {
  const { weekStart, assignments, shiftTypesById, holidaySet } = args
  const out: GuardPayShift[] = []

  for (const a of assignments) {
    const st = shiftTypesById[a.shift_type_id]
    if (!st) continue
    const day = dateOfDay(weekStart, a.day_of_week)
    const start = day.set({ hour: st.start_hour, minute: 0, second: 0, millisecond: 0 })
    const end = start.plus({ hours: st.hours })
    const date = day.toISODate()!
    const nextDate = day.plus({ days: 1 }).toISODate()!
    // GuardPay pays a chag like Shabbat, and its weekend window opens at 16:00
    // on the eve — mirror that: the chag date itself, or an erev-chag shift
    // starting 16:00+.
    const isHoliday = holidaySet.has(date) || (st.start_hour >= 16 && holidaySet.has(nextDate))
    out.push({
      start: start.toUTC().toISO()!,
      end: end.toUTC().toISO()!,
      isHoliday,
      comment: `יובא ממשמרת · ${st.name}`,
    })
  }

  out.sort((a, b) => a.start.localeCompare(b.start))
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/guardpay/build-week.test.ts`
Expected: PASS (10 tests). If an instant assertion fails, the bug is real — do NOT adjust expectations; the expected values are hand-derived from Israel DST rules.

- [ ] **Step 5: Run the full unit suite + commit**

Run: `npm test`
Expected: all green.

```bash
git add src/lib/guardpay/build-week.ts src/lib/guardpay/build-week.test.ts
git commit -m "feat(guardpay): pure week→shifts payload builder with Israel-TZ/DST correctness

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Appwrite execution client (+ fake mode for e2e)

**Files:**
- Create: `src/lib/guardpay/appwrite.ts`
- Modify: `.env.local` (add the five `GUARDPAY_*` vars — values from Task 3's user gate)

**Interfaces:**
- Consumes: `GuardPayErrorCode`, `FindAccountOk`, `ImportWeekOk` (Task 5).
- Produces: `executeGuardPayFunction<T>(action: 'FIND_ACCOUNT' | 'IMPORT_WEEK', payload: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; code: GuardPayErrorCode }>`. The secret is appended server-side; callers never pass it. `GUARDPAY_FAKE=1` short-circuits with fixtures (e2e). Consumed by Task 9.

- [ ] **Step 1: Implement `src/lib/guardpay/appwrite.ts`**

```ts
/**
 * Server-only client for the GuardPay `utilities` Appwrite Function.
 * משמרת holds ONLY an executions-scoped API key + the shared action secret —
 * it can run the function but cannot touch GuardPay data directly.
 * GUARDPAY_FAKE=1 (playwright webServer) short-circuits with fixtures.
 */
import 'server-only'
import type { GuardPayErrorCode } from './types'

export type GuardPayExec<T> = { ok: true; data: T } | { ok: false; code: GuardPayErrorCode }

type Action = 'FIND_ACCOUNT' | 'IMPORT_WEEK'

export async function executeGuardPayFunction<T>(
  action: Action,
  payload: Record<string, unknown>,
): Promise<GuardPayExec<T>> {
  if (process.env.GUARDPAY_FAKE === '1') return fakeExec<T>(action, payload)

  const endpoint = process.env.GUARDPAY_APPWRITE_ENDPOINT
  const project = process.env.GUARDPAY_APPWRITE_PROJECT_ID
  const fnId = process.env.GUARDPAY_FUNCTION_ID
  const key = process.env.GUARDPAY_APPWRITE_API_KEY
  const secret = process.env.GUARDPAY_IMPORT_SECRET
  if (!endpoint || !project || !fnId || !key || !secret) return { ok: false, code: 'EXEC_FAILED' }

  try {
    const res = await fetch(`${endpoint}/functions/${fnId}/executions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Appwrite-Project': project,
        'X-Appwrite-Key': key,
      },
      body: JSON.stringify({
        body: JSON.stringify({ action, payload: { ...payload, secret } }),
        async: false,
        method: 'POST',
        path: '/',
      }),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, code: 'EXEC_FAILED' }
    const exec = (await res.json()) as { status?: string; responseBody?: string }
    if (exec.status !== 'completed') return { ok: false, code: 'EXEC_FAILED' }
    const body = JSON.parse(exec.responseBody ?? '') as { ok?: boolean; code?: GuardPayErrorCode }
    if (!body?.ok) return { ok: false, code: body?.code ?? 'EXEC_FAILED' }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, code: 'EXEC_FAILED' }
  }
}

/** e2e fixtures: FIND_ACCOUNT matches unless the email contains "missing";
 *  IMPORT_WEEK always succeeds and echoes the shift count. */
function fakeExec<T>(action: Action, payload: Record<string, unknown>): GuardPayExec<T> {
  if (action === 'FIND_ACCOUNT') {
    const email = String(payload.email ?? '')
    if (email.includes('missing')) return { ok: false, code: 'NOT_FOUND' }
    return { ok: true, data: { ok: true, userId: 'fake-user-1', name: 'ישראל ישראלי', email } as T }
  }
  const shifts = Array.isArray(payload.shifts) ? payload.shifts : []
  return { ok: true, data: { ok: true, deleted: 0, created: shifts.length, totalAmount: 0 } as T }
}
```

- [ ] **Step 2: Add env vars to `.env.local`** (real values recorded at Task 3's user gate)

```bash
GUARDPAY_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
GUARDPAY_APPWRITE_PROJECT_ID=69583540003a5151db86
GUARDPAY_FUNCTION_ID=697d0f3c001bba7f03d2
GUARDPAY_APPWRITE_API_KEY=<mishmeret-executor key>
GUARDPAY_IMPORT_SECRET=<MISHMERET_SECRET>
```

Also remind the user to add the same five to Vercel (production) before shipping.

- [ ] **Step 3: Type-check, build, commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean (build must succeed even where envs are absent — the client degrades to `EXEC_FAILED`, never throws at import time).

```bash
git add src/lib/guardpay/appwrite.ts
git commit -m "feat(guardpay): server-only Appwrite execution client with e2e fake mode

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Server actions

**Files:**
- Create: `src/app/(employee)/me/schedule/guardpay-actions.ts`

**Interfaces:**
- Consumes: `resolveEmployee`, `periodInWorkplace` from `src/app/(employee)/me/requests/request-helpers.ts`; `executeGuardPayFunction` (Task 8); `buildImportKey`, `buildWeekShifts` (Task 7); `collectHolidayDates` (Task 6); schemas (Task 5).
- Produces (Task 10 calls these):
  - `findGuardPayAccount(input: unknown): Promise<{ ok: true; name: string; email: string } | { error: string }>`
  - `linkGuardPay(input: unknown): Promise<{ ok: true } | { error: string }>`
  - `unlinkGuardPay(): Promise<{ ok: true } | { error: string }>`
  - `syncWeekToGuardPay(input: unknown): Promise<{ ok: true; created: number } | { error: string }>`

- [ ] **Step 1: Implement `src/app/(employee)/me/schedule/guardpay-actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { findAccountSchema, syncWeekSchema } from '@/lib/validation/guardpay'
import { resolveEmployee, periodInWorkplace } from '../requests/request-helpers'
import { executeGuardPayFunction } from '@/lib/guardpay/appwrite'
import { buildImportKey, buildWeekShifts, type ShiftTypeRow } from '@/lib/guardpay/build-week'
import { collectHolidayDates } from '@/lib/guardpay/holiday-dates'
import { GUARDPAY_ERROR_HE, type FindAccountOk, type ImportWeekOk } from '@/lib/guardpay/types'

export type FindResult = { ok: true; name: string; email: string } | { error: string }
export type LinkResult = { ok: true } | { error: string }
export type SyncResult = { ok: true; created: number } | { error: string }

/** Server-side lookup only — the Appwrite userId never round-trips the client. */
async function lookupAccount(email: string) {
  return executeGuardPayFunction<FindAccountOk>('FIND_ACCOUNT', { email })
}

export async function findGuardPayAccount(input: unknown): Promise<FindResult> {
  const parsed = findAccountSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  const email = parsed.data.email ?? user.email
  if (!email) return { error: 'לא נמצא אימייל בחשבון' }

  const r = await lookupAccount(email)
  if (!r.ok) return { error: GUARDPAY_ERROR_HE[r.code] }
  return { ok: true, name: r.data.name, email: r.data.email }
}

export async function linkGuardPay(input: unknown): Promise<LinkResult> {
  const parsed = findAccountSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  const email = parsed.data.email ?? user.email
  if (!email) return { error: 'לא נמצא אימייל בחשבון' }

  // Re-run the lookup server-side — never trust a client-held account id.
  const r = await lookupAccount(email)
  if (!r.ok) return { error: GUARDPAY_ERROR_HE[r.code] }

  const { error } = await supabase.from('guardpay_links').upsert(
    {
      employee_id: employee.id,
      guardpay_user_id: r.data.userId,
      guardpay_email: r.data.email,
      guardpay_name: r.data.name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'employee_id' },
  )
  if (error) return { error: 'שגיאה בשמירת החיבור' }

  revalidatePath('/me/schedule')
  return { ok: true }
}

export async function unlinkGuardPay(): Promise<LinkResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  await supabase.from('guardpay_syncs').delete().eq('employee_id', employee.id)
  const { error } = await supabase.from('guardpay_links').delete().eq('employee_id', employee.id)
  if (error) return { error: 'שגיאה בניתוק החשבון' }

  revalidatePath('/me/schedule')
  return { ok: true }
}

export async function syncWeekToGuardPay(input: unknown): Promise<SyncResult> {
  const parsed = syncWeekSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const { periodId } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  const period = await periodInWorkplace(supabase, periodId, employee.workplace_id)
  if (!period || period.status !== 'published') return { error: 'השבוע אינו מפורסם' }

  const { data: link } = await supabase
    .from('guardpay_links')
    .select('guardpay_user_id')
    .eq('employee_id', employee.id)
    .maybeSingle()
  if (!link) return { error: 'אין חיבור ל-GuardPay' }

  const [{ data: assignments }, { data: shiftTypes }] = await Promise.all([
    supabase
      .from('assignments')
      .select('day_of_week, shift_type_id')
      .eq('period_id', periodId)
      .eq('employee_id', employee.id),
    supabase
      .from('shift_types')
      .select('id, name, start_hour, hours')
      .eq('workplace_id', employee.workplace_id),
  ])
  const holidaySet = await collectHolidayDates(supabase, employee.workplace_id, period.week_start_date)
  const shiftTypesById = Object.fromEntries(
    ((shiftTypes ?? []) as ShiftTypeRow[]).map((s) => [s.id, s]),
  )

  const shifts = buildWeekShifts({
    weekStart: period.week_start_date,
    assignments: assignments ?? [],
    shiftTypesById,
    holidaySet,
  })

  const r = await executeGuardPayFunction<ImportWeekOk>('IMPORT_WEEK', {
    userId: link.guardpay_user_id,
    importKey: buildImportKey(period.week_start_date),
    shifts,
  })
  if (!r.ok) return { error: GUARDPAY_ERROR_HE[r.code] }

  await supabase.from('guardpay_syncs').upsert(
    {
      employee_id: employee.id,
      period_id: periodId,
      synced_at: new Date().toISOString(),
      shift_count: r.data.created,
    },
    { onConflict: 'employee_id,period_id' },
  )

  revalidatePath('/me/schedule')
  return { ok: true, created: r.data.created }
}
```

- [ ] **Step 2: Type-check + lint + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add "src/app/(employee)/me/schedule/guardpay-actions.ts"
git commit -m "feat(guardpay): link/unlink/find/sync server actions (Zod + ownership + published gate)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Branded UI — icon asset, link flow, sync card, page wiring

**Files:**
- Create: `public/guardpay-icon.png` (downscaled from the GuardPay repo)
- Create: `src/app/(employee)/me/schedule/GuardPayLinkFlow.tsx`
- Create: `src/app/(employee)/me/schedule/GuardPaySyncCard.tsx`
- Modify: `src/app/(employee)/me/schedule/page.tsx` (131 lines → ~155; stays <200)

**Interfaces:**
- Consumes: all four actions from Task 9.
- Produces: `<GuardPaySyncCard periodId linked linkedName synced hasShifts />` rendered by the page. Test ids for Task 11: `guardpay-connect`, `guardpay-sync`, `guardpay-synced-badge`, `guardpay-link-confirm`, `guardpay-manual-email`, `guardpay-unlink`.

- [ ] **Step 1: Create the icon asset**

```bash
sips -Z 128 /Users/tzachir/Desktop/MyApps/GuardPay/assets/images/icon.png \
  --out /Users/tzachir/Desktop/MyApps/AutoShiftSchedule/public/guardpay-icon.png
```

Expected: `public/guardpay-icon.png` exists, 128×128, well under 50KB (check with `ls -la`; if sips ballooned it, re-run with `--setProperty formatOptions 80`). Reads from GuardPay's assets — read-only, the app repo is not modified.

- [ ] **Step 2: Create `src/app/(employee)/me/schedule/GuardPayLinkFlow.tsx`**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { findGuardPayAccount, linkGuardPay } from './guardpay-actions'

type Stage =
  | { kind: 'searching' }
  | { kind: 'found'; name: string; email: string; manual: boolean }
  | { kind: 'manual'; error?: string }

/**
 * Inline link flow: auto-match by the account email first; fall back to a
 * manual email field (Apple "הסתר את האימייל שלי" users enter their relay
 * address from הגדרות Apple ID). The Appwrite user id never reaches the
 * client — linkGuardPay re-runs the lookup server-side.
 */
export function GuardPayLinkFlow({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ kind: 'searching' })
  const [email, setEmail] = useState('')
  const [busy, run] = useTransition()

  useEffect(() => {
    let cancelled = false
    findGuardPayAccount({}).then((r) => {
      if (cancelled) return
      if ('ok' in r) setStage({ kind: 'found', name: r.name, email: r.email, manual: false })
      else setStage({ kind: 'manual', error: r.error })
    })
    return () => {
      cancelled = true
    }
  }, [])

  function lookupManual() {
    const value = email.trim()
    if (!value) return
    run(async () => {
      const r = await findGuardPayAccount({ email: value })
      if ('ok' in r) setStage({ kind: 'found', name: r.name, email: r.email, manual: true })
      else setStage({ kind: 'manual', error: r.error })
    })
  }

  function confirmLink(s: Extract<Stage, { kind: 'found' }>) {
    run(async () => {
      const r = await linkGuardPay(s.manual ? { email: s.email } : {})
      if ('error' in r) {
        setStage({ kind: 'manual', error: r.error })
        return
      }
      router.refresh()
      onClose()
    })
  }

  const box = {
    marginTop: 10,
    padding: '12px 14px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    fontSize: 13.5,
  } as const

  if (stage.kind === 'searching') {
    return <div style={box}>מאתר חשבון GuardPay לפי האימייל שלך…</div>
  }

  if (stage.kind === 'found') {
    return (
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          נמצא חשבון GuardPay על שם {stage.name} — לקשר?
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            data-testid="guardpay-link-confirm"
            disabled={busy}
            onClick={() => confirmLink(stage)}
            style={{ flex: 1, padding: '9px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }}
          >
            {busy ? 'מקשר…' : 'קישור החשבון'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStage({ kind: 'manual' })}
            style={{ flex: 1, padding: '9px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-2)', fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }}
          >
            זה לא אני
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={box}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>הזנת אימייל של חשבון GuardPay</div>
      <p style={{ margin: '0 0 8px', color: 'var(--text-2)', lineHeight: 1.5 }}>
        האימייל שאיתו נרשמת ל-GuardPay. נרשמת עם Apple ובחרת ״הסתר את האימייל שלי״? הזינו את
        כתובת ה-relay מהגדרות Apple ID.
      </p>
      {stage.error && (
        <div role="status" style={{ marginBottom: 8, padding: '7px 10px', borderRadius: 10, background: 'rgba(220,70,70,0.1)', color: 'var(--danger)' }}>
          {stage.error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          dir="ltr"
          data-testid="guardpay-manual-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          style={{ flex: 1, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)' }}
        />
        <button
          type="button"
          disabled={busy || !email.trim()}
          onClick={lookupManual}
          style={{ padding: '9px 16px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }}
        >
          {busy ? 'מאתר…' : 'איתור'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/(employee)/me/schedule/GuardPaySyncCard.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncWeekToGuardPay, unlinkGuardPay } from './guardpay-actions'
import { GuardPayLinkFlow } from './GuardPayLinkFlow'

interface Props {
  periodId: string
  linked: boolean
  linkedName: string | null
  synced: boolean
  hasShifts: boolean
}

/** Branded GuardPay band under the week navigator. The app icon is the visual
 *  anchor; re-sync and unlink use the repo's two-step inline confirm idiom. */
export function GuardPaySyncCard({ periodId, linked, linkedName, synced, hasShifts }: Props) {
  const router = useRouter()
  const [linkOpen, setLinkOpen] = useState(false)
  const [confirmResync, setConfirmResync] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [busy, run] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function armed(set: (v: boolean) => void) {
    setMsg(null)
    set(true)
    window.setTimeout(() => set(false), 6000)
  }

  function runSync() {
    setConfirmResync(false)
    setMsg(null)
    run(async () => {
      const r = await syncWeekToGuardPay({ periodId })
      if ('error' in r) {
        setMsg(r.error)
        return
      }
      router.refresh()
    })
  }

  function runUnlink() {
    setConfirmUnlink(false)
    setMsg(null)
    run(async () => {
      const r = await unlinkGuardPay()
      if ('error' in r) {
        setMsg(r.error)
        return
      }
      router.refresh()
    })
  }

  const icon = (
    <img
      src="/guardpay-icon.png"
      alt="GuardPay"
      width={44}
      height={44}
      style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', flexShrink: 0 }}
    />
  )

  const card = {
    marginTop: 12,
    padding: '12px 14px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
  } as const

  if (!linked) {
    return (
      <div style={card}>
        <button
          type="button"
          data-testid="guardpay-connect"
          onClick={() => setLinkOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'start', fontFamily: 'var(--font)' }}
        >
          {icon}
          <span>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>חיבור ל-GuardPay</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-2)' }}>ייבוא המשמרות ישירות לאפליקציית השכר</span>
          </span>
        </button>
        {linkOpen && <GuardPayLinkFlow onClose={() => setLinkOpen(false)} />}
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            מחובר ל-GuardPay{linkedName ? ` · ${linkedName}` : ''}
          </div>
          {synced && (
            <div data-testid="guardpay-synced-badge" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--accent)' }}>
              יובא ל-GuardPay ✓
            </div>
          )}
        </div>
        <button
          type="button"
          data-testid="guardpay-sync"
          disabled={busy || !hasShifts}
          onClick={synced && !confirmResync ? () => armed(setConfirmResync) : runSync}
          title={hasShifts ? undefined : 'אין לך משמרות בשבוע הזה'}
          style={{
            padding: '9px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
            cursor: busy || !hasShifts ? 'default' : 'pointer',
            border: confirmResync ? '1px solid var(--danger)' : 'none',
            background: confirmResync ? 'rgba(220,70,70,0.08)' : 'var(--accent)',
            color: confirmResync ? 'var(--danger)' : '#fff',
            opacity: hasShifts ? 1 : 0.55,
          }}
        >
          {busy ? 'מייבא…' : confirmResync ? 'לחצו שוב לייבוא מחדש' : synced ? 'ייבוא מחדש' : 'ייבוא המשמרות ל-GuardPay'}
        </button>
      </div>
      {confirmResync && (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-2)' }}>
          ייבוא מחדש מחליף את המשמרות שיובאו בעבר לשבוע הזה (משמרות שהוזנו ידנית ב-GuardPay לא נמחקות).
        </p>
      )}
      {msg && (
        <div role="status" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(220,70,70,0.1)', color: 'var(--danger)', fontSize: 13 }}>
          {msg}
        </div>
      )}
      <button
        type="button"
        data-testid="guardpay-unlink"
        disabled={busy}
        onClick={confirmUnlink ? runUnlink : () => armed(setConfirmUnlink)}
        style={{ marginTop: 8, border: 'none', background: 'none', padding: 0, fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer', color: confirmUnlink ? 'var(--danger)' : 'var(--text-2)', textDecoration: 'underline' }}
      >
        {confirmUnlink ? 'לחצו שוב לאישור ניתוק' : 'ניתוק החשבון'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Wire into `src/app/(employee)/me/schedule/page.tsx`**

Add the import (after the `MyRoleCounts` import, line 8):

```ts
import { GuardPaySyncCard } from './GuardPaySyncCard'
```

After the `myRoleCounts` line (line 37), add the two selects:

```ts
  const { data: gpLink } = await supabase
    .from('guardpay_links')
    .select('guardpay_name')
    .eq('employee_id', employee.id)
    .maybeSingle()
  const { data: gpSync } = selectedId
    ? await supabase
        .from('guardpay_syncs')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('period_id', selectedId)
        .maybeSingle()
    : { data: null }
```

Inside the `.schedule-controls` div, directly after `{view && <MyRoleCounts …/>}` (line 111), add:

```tsx
        {view && (
          <GuardPaySyncCard
            periodId={view.periodId}
            linked={!!gpLink}
            linkedName={gpLink?.guardpay_name ?? null}
            synced={!!gpSync}
            hasShifts={myRoleCounts.total > 0}
          />
        )}
```

- [ ] **Step 5: Verify line limits, type-check, build**

Run: `wc -l "src/app/(employee)/me/schedule/page.tsx" "src/app/(employee)/me/schedule/GuardPaySyncCard.tsx" "src/app/(employee)/me/schedule/GuardPayLinkFlow.tsx" && npx tsc --noEmit && npm run build`
Expected: every file ≤200 lines; tsc + build clean.

- [ ] **Step 6: Commit**

```bash
git add public/guardpay-icon.png "src/app/(employee)/me/schedule/GuardPaySyncCard.tsx" "src/app/(employee)/me/schedule/GuardPayLinkFlow.tsx" "src/app/(employee)/me/schedule/page.tsx"
git commit -m "feat(guardpay): branded icon-led sync card + link flow on employee schedule

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Playwright e2e (fake mode) + full green gate

**Files:**
- Modify: `playwright.config.ts` (add `env` to `webServer`)
- Create: `e2e/guardpay-sync.spec.ts`

**Interfaces:**
- Consumes: `signupAndOnboard`, `createInviteCode`, `joinEmployee` from `e2e/setup.ts`; the Task 10 test ids; fake fixtures from Task 8 (auto-match returns "ישראל ישראלי").

- [ ] **Step 1: Enable fake mode in `playwright.config.ts`**

Change the `webServer` block to:

```ts
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // GuardPay integration runs against canned fixtures in e2e — no real
    // Appwrite calls. NOTE: applies only when Playwright starts the server;
    // kill any already-running dev server before `npm run e2e`.
    env: { GUARDPAY_FAKE: '1' },
  },
```

- [ ] **Step 2: Write `e2e/guardpay-sync.spec.ts`**

The joined employee must end up with assignments, so use the **claim path**: the manager pre-creates an employee (with a role switch ON) using a KNOWN phone, and the employee joins with that same phone — claiming the row and its role (see `claim-employee.ts` step 3).

```ts
import { test, expect, type Page } from '@playwright/test'
import { signupAndOnboard, createInviteCode, joinEmployee, uid } from './setup'

/** Manager pre-creates a rostered employee with a role and a KNOWN phone so the
 *  invite-join claims that row (roles preserved) and generation assigns shifts. */
async function addEmployee(page: Page, name: string, phone: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByLabel('טלפון').fill(phone)
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

async function dismissCoverageIssues(page: Page) {
  const dismiss = page.getByRole('button', { name: 'הבנתי' })
  const appeared = await dismiss.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)
  if (appeared) {
    await dismiss.click()
    await expect(dismiss).toBeHidden({ timeout: 5000 })
  }
}

test('employee links GuardPay and imports the published week', async ({ browser }) => {
  test.setTimeout(240_000)
  const token = uid()
  const guardPhone = '0529990001'

  // Manager: workplace + 3 rostered employees (one to be claimed by the guard).
  const manager = await signupAndOnboard(browser, {
    email: `gp-mgr+${token}@example.com`,
    password: 'TestPass123!',
    orgName: `ארגון ${token}`,
    workplaceName: `מקום ${token}`,
  })
  await manager.page.goto('/team')
  await expect(manager.page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(manager.page, 'גארד פיי', guardPhone)
  await addEmployee(manager.page, 'דנה כהן', '0529990002')
  await addEmployee(manager.page, 'יוסי לוי', '0529990003')

  // Guard joins via invite with the SAME phone → claims the rostered row + role.
  const code = await createInviteCode(manager.page)
  const guard = await joinEmployee(browser, code, {
    name: 'גארד פיי',
    email: `gp-emp+${token}@example.com`,
    password: 'TestPass123!',
    phone: guardPhone,
  })

  // Manager: generate + publish.
  await manager.page.goto('/schedule')
  await expect(manager.page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await manager.page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(manager.page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(manager.page)
  await manager.page.getByRole('button', { name: 'פרסם סידור' }).click()
  const confirmPublish = manager.page.getByRole('button', { name: /לחצו שוב לפרסום/ })
  await confirmPublish.click({ timeout: 3000 }).catch(() => {}) // absent when coverage is full
  await expect(manager.page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 15000 })

  // Guard: schedule page shows the GuardPay card → link (fake auto-match).
  await guard.page.goto('/me/schedule')
  await expect(guard.page.getByRole('heading', { name: 'הסידור השבועי' })).toBeVisible({ timeout: 15000 })
  await guard.page.getByTestId('guardpay-connect').click()
  await expect(guard.page.getByText(/נמצא חשבון GuardPay על שם ישראל ישראלי/)).toBeVisible({ timeout: 10000 })
  await guard.page.getByTestId('guardpay-link-confirm').click()

  // Linked state → import.
  const syncBtn = guard.page.getByTestId('guardpay-sync')
  await expect(syncBtn).toBeVisible({ timeout: 15000 })
  await expect(syncBtn).toBeEnabled({ timeout: 15000 }) // claimed role ⇒ has shifts
  await syncBtn.click()
  await expect(guard.page.getByTestId('guardpay-synced-badge')).toBeVisible({ timeout: 15000 })

  // Re-import is a two-step confirm.
  await syncBtn.click()
  await expect(syncBtn).toHaveText('לחצו שוב לייבוא מחדש', { timeout: 3000 })
  await syncBtn.click()
  await expect(guard.page.getByTestId('guardpay-synced-badge')).toBeVisible({ timeout: 15000 })

  await manager.context.close()
  await guard.context.close()
})
```

- [ ] **Step 3: Kill stale dev servers, run the spec**

Run: `lsof -ti :3000 | xargs kill -9 2>/dev/null; npm run e2e -- guardpay-sync.spec.ts`
Expected: 1 passed. If `toBeEnabled` fails because the engine assigned the guard no shifts, the claim path broke — debug the join/claim, do not weaken the assertion.

- [ ] **Step 4: Full gates**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build && npm run e2e`
Expected: everything green (full e2e suite, serialized, may take a while).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/guardpay-sync.spec.ts
git commit -m "test(e2e): GuardPay link + weekly import flow (fake-mode fixtures)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Real-account verification (user-in-the-loop) + docs

**Files:**
- Modify: `CLAUDE.md` (one Pointers line), `docs/architecture.md` (short integration section)

- [ ] **Step 1: Verify env vars in Vercel**

Ask the user to add the five `GUARDPAY_*` vars to Vercel production env (values from Task 3), then deploy.

- [ ] **Step 2: Real-account checklist (with the user, their own GuardPay account)**

1. Link flow on production/dev with the real email → correct name confirmation → linked.
2. Import a published week → open the GuardPay app → shifts appear (realtime) with correct dates/times.
3. **Bucket parity**: pick one weekday morning shift and one Friday-night shift from the import; add identical shifts by hand in the app; compare `total_amount` + hour buckets in the shift details — must match exactly. Delete the hand-added duplicates.
4. Re-tap import → no duplicates (week replaced).
5. Add a manual shift in GuardPay for the same week → re-import → the manual shift survives.
6. Monthly bruto in the GuardPay overview looks sane with the imported week.
7. GuardPay app regression: manual add-shift + monthly summary still work.

- [ ] **Step 3: Documentation touch-ups**

- `CLAUDE.md` → Pointers section, add: `- GuardPay import (employee → external salary app): docs/superpowers/specs/2026-07-23-guardpay-integration-design.md`
- `docs/architecture.md` → add a short "GuardPay integration" subsection: the two tables, the env vars, the function contract, and the TZ constraint.

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md docs/architecture.md
git commit -m "docs: GuardPay integration pointers + architecture notes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
