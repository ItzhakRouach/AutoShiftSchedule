# Unpublish Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manager-only "ביטול פרסום" action that reverts a published weekly schedule back to `status='locked'`, deletes the schedule image from Storage, and exposes a two-step confirm button in the manager schedule view — letting a manager fix a mistakenly-published schedule and re-publish.

**Architecture:** Extract the DB-update + storage-delete core into a pure helper `unpublishPeriod(supabase, admin, workplaceId, periodId)` in `src/lib/publish/unpublish.ts` so it can be unit-tested with fake clients (mirroring how `computePriorDeficit` is tested). The server action `unpublishSchedule(periodId)` in `src/app/(manager)/schedule/actions.ts` is a thin wrapper that handles auth, workplace lookup, calls the helper, and revalidates the manager + employee paths. The client mounts a new `UnpublishButton.tsx` that mirrors `ClearAllButton.tsx` exactly — same 6-second confirm window, same destructive styling.

**Tech Stack:** Next.js 16 App Router server actions, Supabase (Postgres + Storage via admin client), React 19 client component with `useTransition`, Vitest unit tests, Playwright E2E.

Spec: [docs/superpowers/specs/2026-06-04-unpublish-schedule-design.md](../specs/2026-06-04-unpublish-schedule-design.md)

---

## File Structure

- **Create** `src/lib/publish/unpublish.ts` — pure helper `unpublishPeriod(supabase, admin, workplaceId, periodId)`. One responsibility: flip `schedule_periods.status` from `'published'` to `'locked'` for the given (workplace, period) and best-effort delete the image. Returns `{ didUnpublish: boolean }`.
- **Create** `src/lib/publish/unpublish.test.ts` — Vitest unit tests using hand-rolled fake Supabase + admin clients (same posture as `src/lib/schedule/prior-deficit.test.ts`).
- **Modify** `src/app/(manager)/schedule/actions.ts` — append `unpublishSchedule(periodId): Promise<RunResult>` thin wrapper. Handles auth, workplace, calls helper, revalidates `/schedule` and `/me/schedule`.
- **Create** `src/app/(manager)/schedule/UnpublishButton.tsx` — client component. 1:1 mirror of `ClearAllButton.tsx`'s structure (state + 6s timeout + danger style); calls `unpublishSchedule`.
- **Modify** `src/app/(manager)/schedule/ScheduleClient.tsx` — mount `<UnpublishButton periodId={view.periodId} onDone={() => setPublished(false)} />` inside the existing `{published && (...)}` block, after `<ShareButton ... />`.
- **Create** `e2e/unpublish-schedule.spec.ts` — Playwright smoke that signs up, generates, publishes, unpublishes, and asserts the publish button is back.

Each file stays ≤200 lines. No DB migration. No RLS change. No env-var change.

---

## Task 1: Pure helper `unpublishPeriod` (TDD)

**Files:**
- Create: `src/lib/publish/unpublish.ts`
- Create: `src/lib/publish/unpublish.test.ts`

This task does not touch the server action yet — it builds and unit-tests the testable core in isolation. Auth, workplace lookup, and `revalidatePath` are added in Task 2.

- [ ] **Step 1: Write the failing test**

Create `src/lib/publish/unpublish.test.ts`:

```ts
// Unit tests for the pure unpublish helper. Uses hand-rolled fake Supabase +
// admin clients (mirrors src/lib/schedule/prior-deficit.test.ts). The helper
// is the only place that contains DB + storage logic; the server action that
// wraps it is plumbing-only (auth/workplace/revalidate) and is exercised via
// the Playwright smoke in Task 5.
import { describe, it, expect, vi } from 'vitest'
import { unpublishPeriod } from './unpublish'

const WP = 'wp-1'
const PERIOD = 'pd-1'

interface UpdateCall {
  table: string
  setStatus: string
  whereId?: string
  whereWp?: string
  whereStatus?: string
}

interface RemoveCall {
  bucket: string
  paths: string[]
}

function fakeSupabase(updateRowsReturned: number, dbError = false) {
  const calls: UpdateCall[] = []
  const client = {
    from(table: string) {
      const call: UpdateCall = { table, setStatus: '' }
      calls.push(call)
      return {
        update(patch: { status: string }) {
          call.setStatus = patch.status
          return {
            eq(col: string, val: string) {
              if (col === 'id') call.whereId = val
              if (col === 'workplace_id') call.whereWp = val
              if (col === 'status') call.whereStatus = val
              return this
            },
            select() {
              if (dbError) return Promise.resolve({ data: null, error: new Error('boom') })
              const data = Array.from({ length: updateRowsReturned }, (_, i) => ({ id: `row-${i}` }))
              return Promise.resolve({ data, error: null })
            },
          }
        },
      }
    },
  }
  return { client: client as unknown as Parameters<typeof unpublishPeriod>[0], calls }
}

function fakeAdmin(removeShouldThrow = false) {
  const removeCalls: RemoveCall[] = []
  const client = {
    storage: {
      from(bucket: string) {
        return {
          remove(paths: string[]) {
            removeCalls.push({ bucket, paths })
            if (removeShouldThrow) return Promise.reject(new Error('storage down'))
            return Promise.resolve({ data: [], error: null })
          },
        }
      },
    },
  }
  return { client: client as unknown as Parameters<typeof unpublishPeriod>[1], removeCalls }
}

describe('unpublishPeriod', () => {
  it('flips status to locked and deletes the image on the happy path', async () => {
    const { client: sb, calls } = fakeSupabase(1)
    const { client: admin, removeCalls } = fakeAdmin()

    const res = await unpublishPeriod(sb, admin, WP, PERIOD)

    expect(res).toEqual({ didUnpublish: true })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      table: 'schedule_periods',
      setStatus: 'locked',
      whereId: PERIOD,
      whereWp: WP,
      whereStatus: 'published',
    })
    expect(removeCalls).toEqual([
      { bucket: 'schedule-images', paths: [`${WP}/${PERIOD}.png`] },
    ])
  })

  it('is a no-op when no row matched (already locked / wrong workplace)', async () => {
    const { client: sb } = fakeSupabase(0)
    const { client: admin, removeCalls } = fakeAdmin()

    const res = await unpublishPeriod(sb, admin, WP, PERIOD)

    expect(res).toEqual({ didUnpublish: false })
    // No storage call: nothing was unpublished, so nothing to delete.
    expect(removeCalls).toEqual([])
  })

  it('is a no-op when the DB returns an error (defence-in-depth)', async () => {
    const { client: sb } = fakeSupabase(0, true)
    const { client: admin, removeCalls } = fakeAdmin()

    const res = await unpublishPeriod(sb, admin, WP, PERIOD)

    expect(res).toEqual({ didUnpublish: false })
    expect(removeCalls).toEqual([])
  })

  it('still reports didUnpublish: true when storage deletion throws', async () => {
    const { client: sb } = fakeSupabase(1)
    const { client: admin, removeCalls } = fakeAdmin(true)

    const res = await unpublishPeriod(sb, admin, WP, PERIOD)

    expect(res).toEqual({ didUnpublish: true })
    expect(removeCalls).toHaveLength(1) // attempted once
  })

  it('builds the storage path as `${workplaceId}/${periodId}.png`', async () => {
    const { client: sb } = fakeSupabase(1)
    const { client: admin, removeCalls } = fakeAdmin()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await unpublishPeriod(sb, admin, 'wp-A', 'pd-B')

    expect(removeCalls[0].paths).toEqual(['wp-A/pd-B.png'])
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `npm test -- src/lib/publish/unpublish.test.ts --run`
Expected: FAIL — `unpublishPeriod` is not exported (module does not exist yet).

- [ ] **Step 3: Implement `unpublishPeriod`**

Create `src/lib/publish/unpublish.ts`:

```ts
// Pure helper: flip a published schedule period back to 'locked' and best-effort
// delete its image from Storage. Returns whether the DB transition fired (so the
// caller can decide whether to revalidate caches, etc.). All auth/workplace
// resolution is handled by the caller (the server action in actions.ts).
//
// Storage deletion is a courtesy: a failed remove() never fails the unpublish,
// since the source-of-truth is the DB status. The image path mirrors the upload
// path in `src/lib/publish/image.ts` (storagePathFor): `${workplaceId}/${periodId}.png`.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function unpublishPeriod(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  workplaceId: string,
  periodId: string,
): Promise<{ didUnpublish: boolean }> {
  const { data: updated, error } = await supabase
    .from('schedule_periods')
    .update({ status: 'locked' })
    .eq('id', periodId)
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .select('id')

  if (error || !updated || updated.length === 0) {
    return { didUnpublish: false }
  }

  try {
    await admin.storage
      .from('schedule-images')
      .remove([`${workplaceId}/${periodId}.png`])
  } catch {
    // swallow — DB transition succeeded; storage cleanup is best-effort.
  }

  return { didUnpublish: true }
}
```

- [ ] **Step 4: Run the test — confirm PASS**

Run: `npm test -- src/lib/publish/unpublish.test.ts --run`
Expected: PASS — 5/5 tests green.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test --run`
Expected: all PASS.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/publish/unpublish.ts src/lib/publish/unpublish.test.ts
git commit -m "$(cat <<'EOF'
feat(publish): unpublishPeriod helper — status → locked + image cleanup

Pure helper that flips schedule_periods.status from 'published' back to
'locked' for a given (workplace, period) and best-effort deletes the
schedule image from Storage. Returns { didUnpublish } so callers know
whether to revalidate caches. Storage failure never fails the unpublish.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Server action `unpublishSchedule`

**Files:**
- Modify: `src/app/(manager)/schedule/actions.ts` (append)

Thin wrapper: authenticates the user, looks up the active workplace, calls `unpublishPeriod`, revalidates both manager and employee schedule paths. Mirrors the shape of `publishSchedule` in the same file.

- [ ] **Step 1: Read the existing `publishSchedule` for context**

Open `src/app/(manager)/schedule/actions.ts` and inspect the existing `publishSchedule(periodId)` function (around line 150). Note its imports, its return type `RunResult`, the auth/workplace pattern, and the error message constant `GENERIC_ERROR`. Mirror these.

- [ ] **Step 2: Append `unpublishSchedule`**

Add at the end of `src/app/(manager)/schedule/actions.ts` (after the last existing export):

```ts
export async function unpublishSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  try {
    const admin = createAdminClient()
    await unpublishPeriod(supabase, admin, workplace.id, periodId)
  } catch {
    // unpublishPeriod itself never throws; this guards createAdminClient.
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidatePath('/schedule')
  revalidatePath('/me/schedule')
  return { ok: true }
}
```

- [ ] **Step 3: Add the import for `unpublishPeriod`**

At the top of `src/app/(manager)/schedule/actions.ts`, in the existing import block from `@/lib/publish/image`, add a sibling import:

```ts
import { unpublishPeriod } from '@/lib/publish/unpublish'
```

(Keep the existing `buildAndUploadScheduleImage` import — they coexist.)

- [ ] **Step 4: Type-check and full test suite**

Run in parallel:
- `npx tsc --noEmit`
- `npm test --run`

Expected: both clean. (No new tests yet — the server-action plumbing is exercised by the Playwright smoke in Task 5; the unit coverage of the testable core was Task 1.)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(manager\)/schedule/actions.ts
git commit -m "$(cat <<'EOF'
feat(schedule): unpublishSchedule server action

Thin wrapper around unpublishPeriod: auth, workplace lookup, helper call,
revalidate /schedule and /me/schedule. Idempotent — calling on a
non-published period is a soft no-op (didUnpublish: false, ok: true).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Client component `UnpublishButton`

**Files:**
- Create: `src/app/(manager)/schedule/UnpublishButton.tsx`

Mirrors `src/app/(employee)/me/requests/ClearAllButton.tsx` 1:1 in structure. The only difference: it calls `unpublishSchedule` and exposes an `onDone` callback so the parent (`ScheduleClient`) can update its local `published` state.

- [ ] **Step 1: Read `ClearAllButton.tsx` to mirror its style + UX**

Open `src/app/(employee)/me/requests/ClearAllButton.tsx` and note the exact structure (state hooks, `startConfirm` / runner, label switch, button styles, danger colour). Copy that structure.

- [ ] **Step 2: Create the file**

Create `src/app/(manager)/schedule/UnpublishButton.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unpublishSchedule } from './actions'

interface Props {
  periodId: string
  /** Called after a successful unpublish so the parent can clear its local
   *  `published` flag without waiting for the next render. */
  onDone?: () => void
}

/**
 * Two-step confirm button: first click flips the label to "לחצו שוב לאישור
 * ביטול" with a 6-second escape window; second click within that window
 * unpublishes the schedule (status → 'locked') and best-effort deletes the
 * image. Mirrors ClearAllButton's interaction + styling 1:1.
 */
export function UnpublishButton({ periodId, onDone }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, run] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function startConfirm() {
    setMsg(null)
    setConfirming(true)
    // Reset confirm-state after 6s so a stray click doesn't linger.
    window.setTimeout(() => setConfirming(false), 6000)
  }

  function runUnpublish() {
    setConfirming(false)
    setMsg(null)
    run(async () => {
      const r = await unpublishSchedule(periodId)
      if (!r.ok) { setMsg(r.error ?? 'שגיאה'); return }
      onDone?.()
      router.refresh()
    })
  }

  const label = busy
    ? 'מבטל פרסום…'
    : confirming
    ? 'לחצו שוב לאישור ביטול'
    : 'ביטול פרסום'

  return (
    <div style={{ margin: '10px 0 0' }}>
      <button
        type="button"
        data-testid="unpublish-schedule"
        disabled={busy}
        onClick={confirming ? runUnpublish : startConfirm}
        style={{
          width: '100%',
          padding: '11px',
          borderRadius: 14,
          fontSize: 13.5,
          fontWeight: 700,
          fontFamily: 'var(--font)',
          cursor: busy ? 'default' : 'pointer',
          border: `1px solid ${confirming ? 'var(--danger)' : 'var(--border-strong)'}`,
          background: confirming ? 'rgba(220,70,70,0.08)' : 'var(--surface)',
          color: confirming ? 'var(--danger)' : 'var(--text-2)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {label}
      </button>
      {msg && (
        <div
          role="status"
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(220,70,70,0.1)',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      )}
    </div>
  )
}
```

Note: file is ~80 lines, well under the ≤200 limit.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(manager\)/schedule/UnpublishButton.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): UnpublishButton — two-step confirm to unpublish

Mirrors ClearAllButton's interaction (6s confirm window, danger styling).
Calls unpublishSchedule and notifies the parent via onDone so the local
'published' flag in ScheduleClient flips immediately.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Mount the button in `ScheduleClient`

**Files:**
- Modify: `src/app/(manager)/schedule/ScheduleClient.tsx`

The existing JSX renders `<ShareButton ... />` inside `{published && (...)}` (around line 181-186). The new `UnpublishButton` mounts in the same conditional block, immediately after the ShareButton, so the share + unpublish controls live together while the schedule is published.

- [ ] **Step 1: Add the import**

In the existing import block at the top of `src/app/(manager)/schedule/ScheduleClient.tsx` (after `import { ShareButton } from './ShareButton'`), add:

```ts
import { UnpublishButton } from './UnpublishButton'
```

- [ ] **Step 2: Mount the button**

Find the existing `{published && (...)}` block (currently containing only the ShareButton). Replace it with:

```tsx
          {published && (
            <>
              <div style={{ height: 10 }} />
              <ShareButton periodId={view.periodId} weekLabel={view.days[0]?.date ?? ''} shareUrl={view.imageShareUrl ?? null} />
              <UnpublishButton periodId={view.periodId} onDone={() => setPublished(false)} />
            </>
          )}
```

The only delta is the new `<UnpublishButton ... />` line. The `onDone` callback flips the local `published` state so the publish button reappears immediately without waiting for the server round-trip from `router.refresh()` to land.

- [ ] **Step 3: Type-check + lint + test**

Run in parallel:
- `npx tsc --noEmit`
- `npm run lint`
- `npm test --run`

Expected: all clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(manager\)/schedule/ScheduleClient.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): mount UnpublishButton under published indicator

When status is 'published', the manager now sees a two-step "ביטול פרסום"
button alongside the share button. onDone flips the local published flag
so the publish CTA reappears immediately.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Playwright E2E smoke

**Files:**
- Create: `e2e/unpublish-schedule.spec.ts`

End-to-end happy path: sign up → onboard → add employees → generate → publish → unpublish → confirm the publish button is back. Reuses the same `signupAndOnboard` + `addEmployee` helpers as `e2e/schedule-image.spec.ts` (paste them in; the repo currently duplicates these helpers across specs — follow the established pattern, do NOT extract a shared helper module).

- [ ] **Step 1: Create the spec**

Create `e2e/unpublish-schedule.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

/** Sign up → onboard → land on dashboard. (Duplicated from schedule-image.spec.ts — repo pattern.) */
async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `unpub+${uuid}@example.com`
  const password = 'TestPass123!'

  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  await page.getByLabel('שם הארגון').fill(`ארגון ${uuid}`)
  await page.getByLabel('שם מקום העבודה').fill(`מקום עבודה ${uuid}`)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
}

async function addEmployee(page: Page, name: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByRole('switch').first().click() // senior role
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

test('manager can publish, unpublish, and see the publish button return', async ({ page }) => {
  test.setTimeout(180_000)
  await signupAndOnboard(page)

  // Seed a few employees so generation can produce a schedule.
  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  // Generate.
  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })

  // Publish.
  await page.getByRole('button', { name: 'פרסם סידור' }).click()
  await expect(page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 15000 })

  // Unpublish — two-step confirm.
  const unpub = page.getByTestId('unpublish-schedule')
  await expect(unpub).toBeVisible({ timeout: 5000 })
  await expect(unpub).toHaveText('ביטול פרסום')

  await unpub.click()
  await expect(unpub).toHaveText('לחצו שוב לאישור ביטול', { timeout: 2000 })

  await unpub.click()

  // Publish button should be back, "פורסם ✓" should be gone.
  await expect(page.getByRole('button', { name: 'פרסם סידור' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /פורסם/ })).toBeHidden()
})
```

- [ ] **Step 2: Run the new e2e**

Run: `npx playwright test e2e/unpublish-schedule.spec.ts --reporter=line`

Expected: PASS. If it fails, the most likely causes are: (a) the "פרסם סידור" / "פורסם" labels changed (verify against `ScheduleClient.tsx:179`), (b) the `data-testid="unpublish-schedule"` got renamed in Task 3, (c) the WebKit/Chromium browser image was never installed (`npx playwright install` if so).

Do NOT modify production code to make the e2e pass — if the test fails because of a real bug, STOP and report it.

- [ ] **Step 3: Run the unit suite again to confirm no regressions from the e2e setup**

Run: `npm test --run`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/unpublish-schedule.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): manager can publish → unpublish → re-publish

Covers the full round-trip: generate, publish, two-step unpublish confirm,
publish CTA returns. Uses the same signup/onboard/addEmployee helpers as
schedule-image.spec.ts (repo pattern is to duplicate, not share).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test --run`
Expected: all PASS (the 5 new unit tests from Task 1 land in the count; no other counts change).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: `✓ Compiled successfully` and the manager `/schedule` route appears in the route table.

- [ ] **Step 5: Manual smoke (optional but recommended)**

If a local dev server is convenient:

```bash
npm run dev
```

Log in as a manager, generate + publish a schedule, then click "ביטול פרסום" twice. Confirm: (a) the publish button reappears, (b) opening `/me/schedule` as the employee shows the pre-publish empty state, (c) re-publishing works.

If no dev server is available, skip this step — the Playwright smoke from Task 5 covers the same flow.

- [ ] **Step 6: Capture final HEAD**

Run: `git log --oneline -7`
Confirm the 5 commits from Tasks 1-5 are present in order: helper, action, button, mount, e2e. No accidental merge / amend artifacts.

---

## Self-Review Notes

**Spec coverage:**

| Spec section | Implementing task |
|---|---|
| Status target `'locked'` | Task 1 (DB update sets `status='locked'`) |
| Storage image cleanup | Task 1 (helper does best-effort `storage.remove`) |
| Two-step confirm UX | Task 3 (UnpublishButton mirrors ClearAllButton) |
| Mount under publish indicator | Task 4 |
| `revalidatePath('/schedule')` + `revalidatePath('/me/schedule')` | Task 2 |
| Idempotency (call twice → ok) | Task 1 covers the helper's no-op behaviour; Task 2 returns `{ ok: true }` either way |
| Auth gate (manager only) | Task 2 (`if (!user) redirect('/login')` + workplace lookup) |
| RLS unchanged | Spec confirms; no DB migration in any task |
| Employee view falls back to empty state | Task 2 revalidates `/me/schedule`; existing `published-view.ts` handles the gate (no change needed) |
| E2E smoke | Task 5 |
| File size ≤200 lines | Each new file is well under; `ScheduleClient.tsx` adds only one JSX line |

**Placeholder scan:** no TBDs, no "implement later", every step has concrete code or a concrete command. ✅

**Type consistency:** `unpublishPeriod` signature `(supabase, admin, workplaceId, periodId) => Promise<{ didUnpublish: boolean }>` is consistent across Task 1 (definition + test) and Task 2 (call site). The `UnpublishButton` prop name `onDone` is consistent between Task 3 (definition) and Task 4 (call site). The `data-testid="unpublish-schedule"` matches between Task 3 (button) and Task 5 (e2e locator). ✅
