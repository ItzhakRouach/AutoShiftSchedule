// PURE role-rank hierarchy helper. NO IO. Unit-tested directly (see map-rows.test.ts).

/**
 * Role-rank hierarchy expansion. A higher-ranked role automatically qualifies an
 * employee for every lower-ranked role: the employee's effective roles = all
 * workplace roles whose rank ≤ the max rank among the roles they explicitly hold.
 * (e.g. אחמ״ש(3) → all 3; מוקדן(2) → מוקדן+מאבטח; מאבטח(1) → מאבטח.)
 * Returns held ids unchanged when no roles are held. Missing ranks → 1 (lowest).
 */
export function expandRolesByRank(
  heldRoleIds: string[],
  rolesWithRank: { id: string; rank?: number | null }[],
): string[] {
  if (heldRoleIds.length === 0) return []
  const rankById = new Map<string, number>()
  for (const r of rolesWithRank) rankById.set(r.id, r.rank ?? 1)
  let maxRank = 0
  for (const id of heldRoleIds) maxRank = Math.max(maxRank, rankById.get(id) ?? 1)
  return rolesWithRank.filter((r) => (r.rank ?? 1) <= maxRank).map((r) => r.id)
}
