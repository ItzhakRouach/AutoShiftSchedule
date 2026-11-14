# Engine: owner rules from real weeks (2026-11-14)

## Why
The owner rebuilds most of every week by hand. On the four most recent real weeks (63 required cells
each) only 8–22 of ~57 final assignments survive from the engine, "create" (8h-only) leaves 3–6 cells
open, and the 12h completion still leaves 1–2 open in two of the four weeks — where the owner reached
zero every time. A small workforce is the NORMAL week for this workplace, not an edge case.

Evidence: read-only replay of weeks 25.10, 1.11, 8.11, 15.11 through the current engine, plus a probe of
four behaviours (fill order, 12h pairing, flexible requesters and nights, mixing). Findings that drive
this plan:

- **12h pairing bug.** A worker already on an 8h night (23–07) is never upgraded to `m12_night`
  (19–07). The engine places `m12_day` (07–19), counts the whole noon cell as filled, and reports the day
  "covered" with 19:00–23:00 unstaffed (`fallback.ts` TWELVE_HOUR_FILLS, `twelve-plan.ts planCover`,
  `twelve-fill.ts tryDisplace`).
- **Nights.** Any day whose request includes night counts as a *requested night* and is excluded from the
  even split (`night-targets.ts`), and the request floor counts every (day, shift) mark
  (`request-gate.ts`), so a three-shifts-a-day worker has an unreachable floor. Result: flexible workers
  get either almost all the nights or almost none; morning+noon-only workers get zero and no pass may
  fix it.
- **Fill order.** Weekend-first alone moves a shortage onto Wed/Thu as a whole empty day.
- **Mixing.** Per-day matching uses a fixed morning→noon→night slot order; the diversity pass only swaps
  across days and ranks ideal rest 1e6× above variety.

## Owner decisions (confirmed 2026-11-14)
| Topic | Decision |
|---|---|
| Fill order | Friday + Saturday first, then Sunday→Thursday |
| Unavoidable gaps | Protect weekend and ALL night shifts; gaps fall on weekday mornings/noons |
| 12h trigger | Engine works it out automatically as a last resort, **shows a proposal**, applies on approval |
| 12h load | Spread evenly, no hard per-worker limit (coverage wins) |
| 12h goal | Full coverage first; use 12h where needed (not whole-day pairs for their own sake) |
| Night marks | Night counts as *wanted* only when it is the ONLY shift marked that day; otherwise "acceptable" |
| Night fairness | Everyone night-eligible within ±1 night per week; a day-off request is still respected |
| Must-accept | Stay exempt: only the nights they request |
| Rest vs mixing | Balance: mix shift types and co-workers, at most ONE turnaround under 16h per worker per week; the 8h minimum stays hard |

Unchanged hard rules: role match, day off / absence, availability, Shabbat/holiday, min rest, one shift
per day, max shifts.

## Acceptance (real weeks as regression fixtures)
Anonymised fixtures (`fixtures/real-weeks/*.json`: worker ids → letters, no names/phones) built from the
engine inputs of the four weeks; week 15.11 is a faithful input, the three older weeks use the roster of
people who actually worked. For each week, `generateSchedule` with 12h enabled must give:

1. **0 open cells** (the owner reached 0 on all four) — and "covered" must be honest: a noon cell covered
   by 12h needs BOTH halves (07–19 day + 19–07 night partner).
2. **Night spread ≤ 1** among night-eligible, non-exempt workers; nobody above the owner's weekly max (3–4).
3. **12h shifts ≤ the owner's count** for that week (12 / 14 / 8 / 14).
4. **Requests honoured ≥ the owner's count − 2** (40/52, 30/37, 36/41, 33/42). Night fairness now
   outranks "acceptable" marks, so a small drop from today's engine numbers is expected and accepted.
5. Every hard rule holds (existing invariant checks reused).

## Phases (TDD: failing test first in each)
0. **Fixtures + acceptance harness.** Anonymised real-week fixtures and a metrics helper; the acceptance
   tests land as `it.fails`/thresholded so the suite stays green while phases flip them on.
1. **Honest 12h coverage + pairing.** Split the noon cell's 12h coverage into its two halves; let the 12h
   pass upgrade an 8h night to `m12_night` (and an 8h morning to `m12_day`) to complete a pair; move a
   lone noon worker when that completes pairs (the owner's Sunday example); even out 12h load.
   Touches `fallback.ts`, `twelve-plan.ts`, `twelve-fill.ts`, `twelve-rules.ts`, coverage/warnings.
   Tests pinning old behaviour to update: `twelve-fill-guards.test.ts`, `twelve-fill.test.ts`,
   `skip-twelve.test.ts`.
2. **Night semantics + equal split.** "Wanted night" = night-only mark; request floor counts days, not
   marks; targets/floors/evenness use the ±1 rule with must-accept and availability exemptions.
   Touches `night-targets.ts`, `request-gate.ts`, `night-evenness.ts`, `night-floor.ts`, `dayfill.ts`.
3. **Fill order + gap placement.** Fri/Sat first then Sun→Thu as the single order; within a day and
   across the week, when short, staff nights and weekend before weekday morning/noon.
   Touches `fill.ts`, `day-order.ts`, `dayfill.ts`/`matching.ts`, `feasibility.ts`,
   `complete-with-engine.ts`. Tests: `hard-days-first.test.ts`, `fairness.test.ts` (3), `night-evenness` I4.
4. **Mixing.** Same-day swaps in the diversity pass; rest tier becomes "at most one <16h turnaround per
   worker per week" instead of dominating; later passes must not undo it.
   Touches `diversity.ts`, `diversity-cost.ts`, `moves.ts`, pass order in `fill.ts`. Watch `engine-perf.test.ts`.
5. **12h proposal UI.** After auto-assign leaves gaps, show "these days can be closed with 12h shifts"
   (per day: who works 07–19 / 19–07) and apply on approval; replaces the blind completion button.
6. **Spec.** Rewrite the affected sections of `docs/scheduling-engine.md` (it also omits the diversity
   cost's rest/role tiers today).

Each phase: unit tests green, the real-week acceptance numbers reported before/after, then the owner
sees the numbers before the next phase. Nothing ships to `main` until phases 1–3 pass acceptance together
— a half-migrated engine is worse than today's.

## Risks
- Fairness tests encode "chronological is the best base for fairness"; phase 3 changes that premise.
- Older-week fixtures are reconstructions; treat week 15.11 as the primary gate.
- `must_accept`, Shabbat observers and restricted availability shrink the night-eligible pool — the ±1
  rule is computed over the eligible pool only.
