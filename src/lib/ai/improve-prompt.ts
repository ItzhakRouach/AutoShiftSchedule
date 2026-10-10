// Prompt for the second-opinion generator, reframed as IMPROVEMENT.
//
// Generating from scratch made the model re-solve the engine's problem and it
// lost. Here it starts from a complete, legal, 100%-coverage week and may only
// propose exchanges — which is both an easier task and a safer one.
import type { EngineInput, EngineResult } from '@/lib/scheduling/types'
import { encodeWeek } from './encode-week'
import { encodeResult } from './encode-result'
import { DOMAIN_RULESET } from './ruleset'

const TASK = `TASK: improve the schedule below by proposing SWAPS.

You may not add, remove or leave a slot empty. The only change you can propose is
exchanging the occupants of TWO already-filled 8h cells. Coverage therefore stays
exactly as it is, and your job is purely to make the week fairer.

Look for, in this order of value:
1. A worker who requested a shift they did not get, where the person holding it
   did not request it — swap them.
2. A worker carrying more than their share of nights where someone else who can
   work nights carries fewer — swap a night for a non-night cell.
3. A worker below their minimum shifts while someone else is above theirs.
4. אחמ״ש work piled on one holder when another holds fewer.

Rules for each swap:
- Both cells must currently be filled by the worker you name, as shown in # GRID.
- Never propose a swap that breaks a HARD RULE — check rest, Shabbat/holiday,
  availability, one-shift-per-day and max shifts for BOTH workers.
- Never touch a 12h block (rows in # TWELVE).
- A swap that merely moves the problem is worthless; each one must leave the week
  measurably better.

Every swap is re-checked against all hard constraints and the overall fairness
score, and silently discarded if it fails either — so propose only swaps you are
confident in, and propose FEW (typically 3-10). Quality beats quantity.

In "why" give one short Hebrew sentence per swap. In "notes" give a one-paragraph
Hebrew summary of what you were trying to fix.`

export function buildImprovePrompt(input: EngineInput, result: EngineResult) {
  const { text: week, maps } = encodeWeek(input)
  return {
    system: `${DOMAIN_RULESET}\n\n${TASK}`,
    user: `${week}\n${encodeResult(input, result, maps)}`,
    maps,
  }
}
