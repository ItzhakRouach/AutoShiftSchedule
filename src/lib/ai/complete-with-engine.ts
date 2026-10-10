// Turn the AI's ACCEPTED rows into a complete, legal schedule.
//
// The model's output is treated as a SEED, never as a finished product: after
// validation drops anything illegal, the engine's own fill closes every slot
// still open, and the 12h pass runs if the workplace allows it. So the produced
// week is always as complete as the deterministic engine could make it — the AI
// can only influence WHO goes where, never whether the rules hold or whether
// coverage regresses.
//
// Reuses `generalFill` and `runTwelveFill` directly, so the gap-filling logic
// is the engine's, not a reimplementation.
import type { EngineInput, EngineResult } from '@/lib/scheduling/types'
import type { FillState } from '@/lib/scheduling/dayfill'
import { resultFromFillState } from '@/lib/scheduling'
import { generalFill } from '@/lib/scheduling/fill-rounds'
import { runTwelveFill } from '@/lib/scheduling/twelve-fill'
import { satisfiedCount } from '@/lib/scheduling/request-gate'

/**
 * Complete `st` (the AI's accepted rows) with the engine and derive the full
 * EngineResult. Mutates `st`; pass a state you own.
 */
export function completeWithEngine(input: EngineInput, st: FillState): EngineResult {
  // Close whatever is still open, using the engine's own matching so the
  // candidate precedence and every hard constraint are honoured.
  generalFill(input, st, input.days)

  // Last resort for slots 8h cannot staff, exactly as the engine does it.
  if (!input.skipTwelve) {
    st.twelve = [...(st.twelve ?? []), ...runTwelveFill(input, st, input.days)]
  }

  // The fills may land people on requested shifts, so recount from the final
  // committed state or stats.requestsSatisfied would be stale.
  for (const e of input.employees) {
    st.satisfied[e.id] = satisfiedCount(input, e.id, st.committed[e.id])
  }

  return resultFromFillState(input, st)
}
