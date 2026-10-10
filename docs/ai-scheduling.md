# AI scheduling layer (Claude Opus 5)

Optional, opt-in layer on top of the deterministic engine. The engine stays the
correctness authority: Claude never publishes a schedule that has not been
re-validated by `validateAssignment` / `canTwelve`. See
`~/.claude/plans/now-that-claude-is-tidy-beacon.md` for the approved design.

## Billing

- Monthly API credit included with Claude Max 5x: **$100/month**, refreshed each
  billing cycle, **no rollover**. Linked Console organization: **ItzhakRouach**.
- Covers the Claude API, Managed Agents, Agent SDK and playground. Does **not**
  cover Claude Code or extra usage in the Claude apps.
- **There is no card overflow.** When credits run out the API returns
  `Your credit balance is too low to access the Anthropic API.` and requests
  stop until the next cycle — usage is never charged to the Claude plan. So the
  credit is a hard ceiling unless purchased credits or auto-reload are added.
  Keep auto-reload OFF.
- Per-project cap: give the project its own Console **workspace** and set that
  workspace's spend limit. That is platform-enforced, unlike the app-level
  `AI_MONTHLY_BUDGET_USD` check (which only guards against a runaway loop).
- Docs: https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers

## Measured cost (real week: אגירה שאובה 2026-10-11, 14 employees, 63 slots)

Token counts measured with `messages.countTokens` on `claude-opus-5`
($5/MTok in, $25/MTok out).

### Prompt encoding — input tokens for the same week

| Encoding | chars | tokens | vs raw |
|---|---|---|---|
| `JSON.stringify(EngineInput)` | 11,931 | 6,618 | 1.00x |
| \+ employee UUIDs → `e0..e13` | 10,583 | 5,678 | 0.86x |
| \+ Hebrew role names → `R0..R2` | 11,634 | 6,261 | **0.95x** |
| both of the above | 10,286 | 5,321 | 0.80x |
| both + prune no-op request days | 7,709 | 4,049 | 0.61x |
| **purpose-built terse line format** | 1,663 | **1,563** | **0.24x** |

**The Hebrew was not the problem — it is worth only 5%.** Short ids beat it
(14%), pruning the all-default request rows beats both (39%), and the *format*
is the whole story (76%). Deeply nested JSON spends most of its tokens on
punctuation and repeated keys.

### Why total cost barely moves

| | input tok | cost @ 8k output |
|---|---|---|
| raw JSON + whole `scheduling-engine.md` as system prompt | 13,998 | $0.270 |
| terse format + purpose-built ~2k system prompt | 3,563 | $0.218 |

A 76% input reduction is only a **~19% total** reduction, because output tokens
dominate: 8,000 output tokens alone cost $0.200. The real cost levers are
`output_config.effort` and how much rationale we ask for — not the encoding.

**So adopt the terse format for ACCURACY, not cost:** 1,563 tokens of aligned
table is far less for the model to wade through than 6,618 tokens of nested
JSON, and mis-selection errors are the expensive failure here, not tokens.

Note the system prompt (7,380 tokens if we ship `docs/scheduling-engine.md`
verbatim) is larger than the payload. Write a purpose-built ruleset instead, and
put the stable prefix (ruleset + roster + staffing requirements) behind a
`cache_control` breakpoint — only the weekly requests vary, so repeat runs pay
~10% on input.

### Budget

At ~$0.17 (terse schedule) to ~$0.27 (with rationale) per run, the $100 credit
is roughly **370–590 generations/month**. Cost is not a constraint for a single
workplace; it would become one only on distribution.

## Terse prompt format

```
# ROSTER  id|roles|type|min|max|shabbat|holidays|mustAccept|avail
e8|R0+R2+R1|p|2|4|S|H|-|0:M,1:A,2:MA,5:M
# DAYS idx|holiday|holidayEve
# NEED day|shift|role|count
# REQ emp|day|off(O=soft,X=hard)|wants
# SETTINGS minRest=8 idealRest=16 allow12h=true mgrRole=R0
```

Shifts are `M`=בוקר 07–15, `A`=צהריים 15–23, `N`=לילה 23–07. Employee ids and
role names are mapped to short keys with a bidirectional map built per request;
the model's reply is translated back before validation, and any id it invents
fails the roster check.

## What is built (Part B1 — Hebrew explanation)

Read-only. It describes a finished `EngineResult` in prose and cannot produce or
change an assignment, so there is nothing to validate.

| File | Role |
|---|---|
| `src/lib/ai/keys.ts` | employee/role ↔ short-key maps; also the trust boundary — an invented key resolves to `undefined` |
| `src/lib/ai/encode-week.ts` | `EngineInput` → the terse week table |
| `src/lib/ai/encode-result.ts` | `EngineResult` → grid, gaps+reasons, 12h, overridden offs, night imbalance, per-worker stats |
| `src/lib/ai/ruleset.ts` | the byte-stable system prompt (cacheable); deliberately not the whole engine doc |
| `src/lib/ai/explain.ts` | `buildExplainPrompt` (pure, testable) + `explainSchedule` |
| `src/lib/ai/client.ts` | server-only client; never throws, typed error codes, `AI_FAKE` fixtures ignored in production |
| `src/lib/ai/names.ts` | puts real names back; guards the `e1`-inside-`e10` prefix collision |
| `src/app/(manager)/schedule/ai-actions.ts` | the server action (Zod-validated, auth + workplace scoped) |
| `src/app/(manager)/schedule/AiExplain*.tsx` | opt-in button in the coverage popup + a minimal non-HTML renderer |

### Measured on the real week

First call: 2,496 input + 1,627 cache-write + 1,838 output tokens = **$0.069**.
Repeat calls read the cached prefix instead of writing it, so steady state is
**~$0.047**. System prompt is 1,627 cached tokens, versus 7,380 had we shipped
`docs/scheduling-engine.md` verbatim.

The output correctly identified full 63/63 coverage, the three below-minimum
workers and the hard `X` off-requests behind them, the unapproved requests and
which availability map blocked each, ניר ממן at 3 nights against a target of 2,
and why Saturday needed a 12h pair (Shabbat observers plus hard offs left too
few אחמ״ש for three 8h shifts) — with a concrete alternative.

### Known limitation

The action regenerates the schedule to explain it. The engine is deterministic
(seed from the period id), so this reproduces the persisted AUTO schedule
exactly — but **manual and 12h edits are not reflected**, and the UI says so
when the period has any. Explaining the persisted grid verbatim needs
`resultFromFillState` (extracting the tail of `engine.ts`), which belongs with
the second-opinion generator.

### Not yet built

Cost tracking (`ai_runs`) and the per-workplace budget guard arrive with the
second-opinion generator, which needs a table anyway to hold proposals
server-side. Until then the enforceable cap is the Console workspace spend
limit, and the monthly credit itself hard-stops.
