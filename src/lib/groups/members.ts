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
