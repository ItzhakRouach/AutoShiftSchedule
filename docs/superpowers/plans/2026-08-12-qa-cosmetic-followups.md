# QA Cosmetic Follow-ups (from 2026-08-12 night-distribution + audit session)

Source: independent QA review of commits `252d2ce..48d4cf6` (even night distribution +
audit fixes). Verdict was **ship** — these five warnings are non-blocking polish, plus
two optional suggestions. Each item is independent; do in any order, run `npm test` +
`npx tsc --noEmit` after each.

## 1. Publish cron: silent skip of stale periods outside the 14-day window
- File: `src/lib/publish/run.ts` (`MAX_RETRO_DAYS`, `publishForWorkplace`)
- Problem: a workplace whose only unpublished `locked` period is ≥15 days old (backfill,
  restore, long pause) will never auto-publish and nothing signals why.
- Fix: when the periods query returns 0 rows, run a second cheap query WITHOUT the
  `.gte(minWeek)` filter (limit 1); if a stale row exists, `console.warn` with the
  workplace id + week so Vercel logs explain the skip. Do NOT publish it.

## 2. Night-target formula slightly over-caps with mid-tier requesters
- File: `src/lib/scheduling/night-targets.ts` (`buildNightThresholds`)
- Problem: only requests ABOVE the naive share count as "absorbed" (`excess`), so a mix
  of e.g. one 3-night + one 2-night requester yields total threshold capacity one above
  the real night count. Never under-caps — purely a tightness nit.
- Fix (choose one): (a) document the looseness in the doc comment and close; or
  (b) tighten: subtract `min(requestedNights, naive)` per requester from `remaining` and
  recompute pool as non-requesters only — add a table case to `night-targets.test.ts`
  first (TDD) and confirm `night-evenness.test.ts` stays green.

## 3. Cron catch loses the stack trace
- File: `src/lib/publish/run.ts` (`publishDuePeriods` mapBounded catch)
- Fix: `console.error('[publish cron]', s.workplace_id, e)` before returning the error
  string, so Vercel logs keep the full stack.

## 4. ObservancePicker: one-way Shabbat→holiday coupling
- File: `src/app/join/[code]/ObservancePicker.tsx`
- Problem: checking Shabbat auto-checks holidays, but UNchecking Shabbat leaves holidays
  on — a user who mis-clicks ends up silently marked as a holiday observer.
- Fix: pick one: (a) drop the auto-check entirely (fully independent boxes), or
  (b) mirror on uncheck too (`if (!v) onHolidays(false)`), keeping manual holiday-only
  selection possible afterwards. Preference: (a) — simplest mental model.
- Verify with the join-flow e2e (needs port 3000 free).

## 5. Dead initialization in pickCollectionWeek
- File: `src/lib/requests/collection-week.ts` (`pickCollectionWeek`)
- Problem: `let weekStart = opts.firstWeek` is always overwritten inside the loop; if
  `MAX_CANDIDATE_WEEKS` were ever 0 the function would return a misleading default.
- Fix: compute `weekStart` inside the loop scope and track the last candidate
  explicitly, or assert/comment the `MAX_CANDIDATE_WEEKS >= 1` invariant.

## Optional (🟢 suggestions from the same review)
- Hard-coded colors (`#C2410C`, `#EB6A4E`, `#E0902A`, `#13A98E`) in
  `CoverageIssues.tsx` / dashboard cards → promote to `theme.css` tokens (pre-existing
  pattern, not introduced by the session).
- `bestMove` in `src/lib/scheduling/diversity.ts` uses a one-element array as an
  accumulator → replace with `let best: {move, cost} | null`.

## Verification
- `npm test`, `npx tsc --noEmit`, `npm run lint` after each item.
- Item 4 touches UI → `npm run e2e` (join spec) per the e2e drift rule.
