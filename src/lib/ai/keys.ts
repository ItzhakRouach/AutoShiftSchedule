// Bidirectional short-key maps for the Claude prompt.
//
// Employee ids are UUIDs (36 chars) and role ids are Hebrew names; both repeat
// on nearly every prompt line. Replacing them with `e0..eN` / `R0..RN` cuts
// input tokens (measured: ids 14%, roles 5% — see docs/ai-scheduling.md) and,
// more importantly, keeps the prompt narrow enough to read at a glance.
//
// The maps are also the trust boundary: the model replies in short keys, and
// any key it invents resolves to `undefined`, so a hallucinated employee can
// never reach the validator. Pure & deterministic — roles key off a SORTED role
// universe so the mapping is independent of `input.employees` order.
import type { EngineInput } from '@/lib/scheduling/types'

export interface KeyMaps {
  /** employeeId → short key (`e0`), or undefined if not on the roster. */
  empKey(id: string): string | undefined
  /** short key → employeeId, or undefined for anything invented. */
  empId(key: string): string | undefined
  /** roleId (Hebrew name) → short key (`R0`). */
  roleKey(id: string): string | undefined
  /** short key → roleId. */
  roleId(key: string): string | undefined
  /** roleId → short key, as a plain object (for logging/debugging). */
  roleKeys: Record<string, string>
  /** employeeId → short key, as a plain object. */
  empKeys: Record<string, string>
}

export function buildKeyMaps(input: EngineInput): KeyMaps {
  const empKeys: Record<string, string> = {}
  const empIds: Record<string, string> = {}
  input.employees.forEach((e, i) => {
    const k = `e${i}`
    empKeys[e.id] = k
    empIds[k] = e.id
  })

  // Sorted so the mapping never depends on roster order. Roles come from both
  // the employees and the requirements, mirroring `grid.ts rolesInInput`.
  const roleUniverse = new Set<string>()
  for (const e of input.employees) for (const r of e.roleIds) roleUniverse.add(r)
  for (const byShift of Object.values(input.requirements)) {
    for (const byRole of Object.values(byShift)) {
      for (const r of Object.keys(byRole)) roleUniverse.add(r)
    }
  }
  const roleKeys: Record<string, string> = {}
  const roleIds: Record<string, string> = {}
  ;[...roleUniverse].sort().forEach((r, i) => {
    const k = `R${i}`
    roleKeys[r] = k
    roleIds[k] = r
  })

  return {
    empKey: (id) => empKeys[id],
    empId: (key) => empIds[key],
    roleKey: (id) => roleKeys[id],
    roleId: (key) => roleIds[key],
    roleKeys,
    empKeys,
  }
}
