/**
 * Pure member-set helpers for Groups  (Slice #18.07)
 *
 * Kept dependency-free (no DB import) so it can be unit-tested in isolation.
 */

/**
 * Split a desired member set against the current one into the ids to add and
 * the ids to remove. Order-independent for membership; the returned arrays
 * preserve the input order of `desired` (adds) and `current` (removes).
 */
export function computeMemberDelta(
  current: string[],
  desired: string[],
): { toAdd: string[]; toRemove: string[] } {
  const cur = new Set(current);
  const des = new Set(desired);
  return {
    toAdd: desired.filter((id) => !cur.has(id)),
    toRemove: current.filter((id) => !des.has(id)),
  };
}

/** A record the update would put over the per-item cap, and the groups it is already in. */
export type OverLimitItem = {
  id:     string;
  code:   string;
  groups: { id: string; code: string }[];
};

/**
 * The records being added that are already in `limit` other groups or more — each with those groups, by code.
 *
 * The cap used to stop at the first such record and say only that one existed, so Adrian could not tell which of
 * a whole map selection it was, nor which of its groups to take it out of (2026-10-18). Every one is named now, in
 * the order they were asked for. `memberships` holds one row per (record, other group); a repeated row counts once.
 */
export function membersOverLimit(
  toAdd: { id: string; poId: string }[],
  memberships: { poId: string; groupId: string; groupCode: string }[],
  limit: number,
): { id: string; poId: string; groups: { id: string; code: string }[] }[] {
  const byPo = new Map<string, Map<string, string>>();
  for (const m of memberships) {
    let groups = byPo.get(m.poId);
    if (!groups) byPo.set(m.poId, (groups = new Map()));
    groups.set(m.groupId, m.groupCode);
  }
  const out: { id: string; poId: string; groups: { id: string; code: string }[] }[] = [];
  const seen = new Set<string>();
  for (const a of toAdd) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const groups = byPo.get(a.poId);
    if (!groups || groups.size < limit) continue;
    out.push({
      id:     a.id,
      poId:   a.poId,
      groups: [...groups].map(([id, code]) => ({ id, code })).sort((x, y) => x.code.localeCompare(y.code)),
    });
  }
  return out;
}
