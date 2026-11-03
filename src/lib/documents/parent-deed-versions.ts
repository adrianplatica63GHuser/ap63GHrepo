/**
 * Which deed a version of an act adițional amended.                                                 (Slice 41.54)
 *
 * A snapshot written since 41.54 says it (`parentDeed.id`). One written before does not, and is never rewritten
 * (the header's Ask first 3: a migration that rewrote stored rows would wait for Adrian). So such a snapshot reads its
 * deed from the EARLIEST LATER snapshot that has the block: that snapshot's `before` when it has one — the deed linked
 * just before the first link change made over the old history — else its `id`; and with no later block at all, from
 * the link the act has now. Adrian's case: v0 (no block) linked to the contract; „Dezleagă" writes v1
 * `{ id: null, before: contract }`; v0 reads „the contract".
 *
 * Pure: the screen gives it the versions it already holds.
 */
import type { DocumentSnapshot } from "./validation";

export function deedOfVersion(
  versions: readonly { versionNumber: number; snapshot: DocumentSnapshot }[],
  versionNumber: number,
  current: string | null,
): string | null {
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const at = sorted.findIndex((v) => v.versionNumber === versionNumber);
  if (at === -1) return current;
  const own = sorted[at].snapshot.parentDeed;
  if (own !== undefined) return own.id ?? null;
  for (const later of sorted.slice(at + 1)) {
    const block = later.snapshot.parentDeed;
    if (block === undefined) continue;
    return block.before !== undefined ? (block.before ?? null) : (block.id ?? null);
  }
  return current;
}
