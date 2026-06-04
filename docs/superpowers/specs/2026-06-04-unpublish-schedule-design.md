# Unpublish Schedule — Design Spec

**Date:** 2026-06-04
**Topic:** Manager action: revert a published weekly schedule back to the editable post-deadline state.
**Scope:** One spec, one implementation plan. No sub-projects.

## Goal

When a manager has clicked "פרסם" by mistake — or realises after publishing that the schedule needs a fix — they need a way to **un-publish** the current week's schedule, edit it, and publish again. The action is rare but real ("hit publish too soon"), and today there is no escape hatch: the manager has to live with a wrong schedule until next week.

## Non-Goals

- Decoupling the published flag from the data (e.g., a separate "draft assignments" table). Out of scope; we reuse the existing single grid.
- Notifying employees via WhatsApp/Email that the schedule was withdrawn. The free-tier MVP does not auto-notify; the manager communicates externally if needed.
- Recalling messages already sent through the WhatsApp share link or per-employee text. Those are external side-effects we cannot reverse.
- A historical audit log of publish/unpublish events. Could be added later; not needed for the MVP.
- Showing a "this schedule was withdrawn" banner to employees. Confirmed in brainstorming: post-unpublish employee view is identical to the pre-publish empty state.

## Status Model

The existing `schedule_periods.status` enum is `'collecting' | 'locked' | 'published'`. The semantics already cover the unpublish destination:

- **`collecting`** — employees still submitting requests. Schedule not generated.
- **`locked`** — requests closed; manager edits the schedule grid; not yet visible to employees.
- **`published`** — schedule is visible to employees; manager edits still allowed but treated as updates to a live schedule.

**Unpublish target: `locked`.** Reusing this state is exact-fit: "requests closed, manager editing toward publish" is identical to "withdrew publish, fixing before re-publishing". No new enum value, no migration, no RLS churn.

## User Flow

1. Manager opens `/schedule`. Period is `published` — the publish indicator (currently "פורסם") is visible.
2. Adjacent to or below the publish indicator, a destructive-style button labelled **"ביטול פרסום"** appears (only when `status === 'published'`).
3. First click flips the button label to **"לחצו שוב לאישור ביטול"** with the danger colour, and starts a 6-second escape window. (Mirrors `ClearAllButton.tsx` exactly — same UX pattern users already learned.)
4. Second click within 6 seconds:
   1. Server action `unpublishSchedule(periodId)` runs.
   2. DB: `UPDATE schedule_periods SET status='locked' WHERE id = :periodId AND workplace_id = :workplace AND status = 'published'` (the `status='published'` guard makes the call idempotent — double-fire is a no-op).
   3. Storage best-effort: delete `schedule-images/{workplaceId}/{periodId}.png` via the admin client. Failure does not fail the action (same posture as the publish image upload, which is also best-effort).
   4. `revalidatePath('/schedule')` and `revalidatePath('/me/schedule')` so both manager and employee views reload.
5. UI reflects the new state: button disappears, `RunButton`/`PublishButton` (or equivalent draft-state controls) reappear. Manager edits the assignments and clicks publish again when ready.
6. If outside the 6-second window or button never reaches the confirm state, no action is taken.

## Employee View

`/me/schedule` already gates the rendered grid on `status === 'published'` via `src/lib/schedule/published-view.ts`. After unpublish:

- An employee who revisits the page sees the pre-publish empty state ("הסידור טרם פורסם" or equivalent).
- An employee who already loaded the page before the unpublish keeps a stale view until they navigate. We do **not** add real-time invalidation for this — the next page load (or pull-to-refresh on the PWA) is sufficient. Adding push/SSE for this is overkill given the rarity of the action.
- The `assignments` and `day_notes` RLS policies that gate on `status='published'` automatically deny employee reads once the status flips. No policy changes needed.

## Server Action: Shape

File: `src/app/(manager)/schedule/actions.ts` (sibling to `publishSchedule`).

```ts
export async function unpublishSchedule(periodId: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const { data: updated, error } = await supabase
    .from('schedule_periods')
    .update({ status: 'locked' })
    .eq('id', periodId)
    .eq('workplace_id', workplace.id)
    .eq('status', 'published') // idempotency guard
    .select('id, workplace_id')

  if (error) return { ok: false, error: GENERIC_ERROR }
  if (!updated || updated.length === 0) {
    // Either the period does not belong to this workplace, or it is not
    // currently 'published' — both map to a soft no-op success so a
    // double-click in the same window does not surface a scary error.
    revalidatePath('/schedule')
    revalidatePath('/me/schedule')
    return { ok: true }
  }

  // Best-effort: delete the storage object so a still-circulating share link
  // 404s instead of showing the withdrawn image. Never fails the unpublish.
  try {
    const admin = createAdminClient()
    await admin.storage
      .from('schedule-images')
      .remove([`${workplace.id}/${periodId}.png`])
  } catch {
    // swallow — DB transition succeeded; storage cleanup is a courtesy.
  }

  revalidatePath('/schedule')
  revalidatePath('/me/schedule')
  return { ok: true }
}
```

**Key properties:**
- Authorisation rides on the existing RLS policy `schedule_periods_manager_all` (`owns_workplace(workplace_id)`) — the manager's user session already grants UPDATE on rows for workplaces they own.
- Idempotency: the `.eq('status', 'published')` clause means a second call returns 0 updated rows; we map that to `ok: true` so the UI doesn't flash an error.
- Image deletion is wrapped in try/catch; the DB transition is the source of truth, storage is a courtesy.
- Same return-shape contract as `publishSchedule` so the client code can reuse the existing `RunResult` handler.

## Client Component: Shape

File: `src/app/(manager)/schedule/UnpublishButton.tsx` (new). Mirrors `ClearAllButton.tsx` structure 1:1 for visual + interaction consistency.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unpublishSchedule } from './actions'

interface Props {
  periodId: string
}

/**
 * Two-step confirm button: first click flips the label to "לחצו שוב לאישור
 * ביטול" with a 6-second escape window; second click within that window
 * unpublishes the schedule (status → 'locked') and deletes the image.
 * Mirrors ClearAllButton's interaction pattern.
 */
export function UnpublishButton({ periodId }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, run] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function startConfirm() {
    setMsg(null)
    setConfirming(true)
    window.setTimeout(() => setConfirming(false), 6000)
  }

  function runUnpublish() {
    setConfirming(false)
    setMsg(null)
    run(async () => {
      const r = await unpublishSchedule(periodId)
      if ('error' in r && r.error) { setMsg(r.error); return }
      router.refresh()
    })
  }

  const label = busy
    ? 'מבטל פרסום…'
    : confirming
    ? 'לחצו שוב לאישור ביטול'
    : 'ביטול פרסום'

  // ... identical styled <button> + msg block as ClearAllButton
}
```

**Placement:** in `ScheduleClient.tsx`, the existing JSX has a "published" indicator block that renders when `published === true`. The unpublish button mounts inside that same conditional block, below the "פורסם" badge.

## Edge Cases & Decisions

| Case | Behaviour |
|------|-----------|
| Manager clicks unpublish twice fast | Second click is the confirm; subsequent server-side call sees `status != 'published'` and returns the no-op success. No error to the UI. |
| Period belongs to a different workplace (impossible via RLS) | Server returns `ok: false, error: GENERIC_ERROR` from the catch path; UI shows the message. Defence-in-depth only — RLS already blocks this. |
| Storage delete fails (Supabase down, file already missing) | Logged-silent; DB transition stands. Next publish overwrites the object anyway (`upsert: true`). |
| Manager is currently editing a 12h fallback when they unpublish | No effect on assignments — the grid stays intact. Manager continues editing post-unpublish. |
| Employee has the page open when unpublish fires | They keep their stale local view until next navigation. Real-time invalidation is out of scope. |
| Schedule already had `revalidatePath` propagation race | Standard Next.js behaviour; both `/schedule` and `/me/schedule` are revalidated to minimise the window. |
| Periodic data downstream (e.g., schedule_image_url cache, snapshots) | Snapshots in `twelve_pair_snapshots` are independent of `status`. Image URL is regenerated on the next publish via `buildAndUploadScheduleImage`. |

## Testing Strategy

The repo's pattern for server actions is co-located unit tests (see `src/app/(manager)/settings/requirements-actions.test.ts`), with no component-level button tests. We follow that pattern.

Unit (Vitest) — `src/app/(manager)/schedule/unpublish-actions.test.ts`:
- `unpublishSchedule` happy path — published → locked, storage deletion attempted once with the correct path `{workplaceId}/{periodId}.png`.
- Idempotency — calling twice in a row returns `{ ok: true }` both times; second call sees the period already in `locked` and attempts no storage delete.
- Status guard — calling on a `locked` period (already unpublished) is a no-op success.
- Status guard — calling on a `collecting` period (impossible UI-wise but worth covering) is a no-op success.
- Image-delete failure — DB transition still reports `ok: true`.
- Auth gate — unauthenticated call redirects to `/login`.
- Workplace mismatch — calling with a `periodId` from another workplace returns `{ ok: true }` (RLS denies the UPDATE, our update returns 0 rows; we map to no-op success).

E2E (Playwright, smoke) — `e2e/unpublish-schedule.spec.ts`:
- Manager publishes, sees "פורסם" + the unpublish button. Two-click unpublishes. The page reloads to the editable draft state with the publish button re-shown.
- Employee opens `/me/schedule` after unpublish, sees the empty "טרם פורסם" state.

Button interaction (label flips, 6s timeout, error surfacing) is covered indirectly by the E2E happy-path and intentionally NOT unit-tested at the component level — matching the repo's existing testing posture.

## Open Risks & Mitigations

1. **Stale `revalidatePath` on employee view.** Mitigation: explicit revalidate of both paths in the action. Acceptable residual: an employee with the page open keeps a stale view until they navigate. Cost of fixing fully (SSE / real-time) is not justified for an action that should be very rare.
2. **External WhatsApp share leftovers.** Out of scope — we don't control external chat. The storage delete makes the share-link image 404 to minimise.
3. **No audit trail.** Accepted MVP. If we later need "who unpublished and when", add a `period_status_history` table in a follow-up — it composes cleanly because we're not coupling status to other fields.

## Implementation Sketch (handed to writing-plans)

Files this design touches:
- `src/app/(manager)/schedule/actions.ts` — add `unpublishSchedule`.
- `src/app/(manager)/schedule/UnpublishButton.tsx` — new client component (mirror of `ClearAllButton.tsx`).
- `src/app/(manager)/schedule/ScheduleClient.tsx` — mount the button inside the existing `published` indicator block.
- `src/app/(manager)/schedule/unpublish-actions.test.ts` — co-located unit tests for the action (matches `requirements-actions.test.ts` pattern in the same parent directory).
- `e2e/unpublish-schedule.spec.ts` — Playwright smoke.

No DB migration. No RLS change. No new env vars.

Each file stays ≤200 lines (project rule) — `UnpublishButton.tsx` is ~70 lines mirroring `ClearAllButton`, the server action is ~30 lines, and tests are independently bounded. `ScheduleClient.tsx` adds one conditional JSX block (no growth concern).
