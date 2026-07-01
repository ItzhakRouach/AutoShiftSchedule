// Dev-only opt-in pass-timing helper (see EngineInput.collectTimings). Pure:
// `performance.now()` measurement has no effect on scheduling decisions or
// determinism, so using it here does not compromise engine purity.
import type { FillState } from './dayfill'

/**
 * Run `fn` and, when `st.timings` exists (i.e. timing was requested), record
 * its wall time (ms) under `key`. A no-op wrapper (just calls `fn`) when
 * timings were not requested, so the hot path pays no `performance.now()` cost.
 */
export function timed(st: FillState, key: string, fn: () => void): void {
  if (!st.timings) {
    fn()
    return
  }
  const start = performance.now()
  fn()
  st.timings[key] = performance.now() - start
}
