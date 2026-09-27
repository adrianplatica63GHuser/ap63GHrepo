/**
 * Which way a role reads on a self-referencing pair table.   (Slice #37.10, FU-220)
 *
 * `property_property` (like `document_document`) stores a pair in UUID order —
 * `CHECK (a < b)` — only so one pair cannot be stored twice. The order means
 * nothing, so a directional role („Inclus în") needs a flag saying which way it
 * reads: `role_reads_a_to_b` (migration_087, migration_086 for documents).
 *
 * These two functions are the property family's copy of the document family's
 * `manualLinkDirection` / `roleReadsFromDocument` (referenced-instruments.ts,
 * #36.19), named for any pair. The document ones are left where they are: a
 * code guard there pins that path to them.
 */

/**
 * The stored triple for a link made BY HAND on the screen of `viewedId`.
 *
 * The „Asociază" picker is phrased from the record whose screen it is on —
 * „this property <role> the one you tick" — so the role reads FROM `viewedId`,
 * and the flag is simply whether `viewedId` landed on side A of the sort. Per
 * pair, so it is right for several ticked records at once, whichever way each
 * pair's uuids sort.
 */
export function manualPairDirection(
  viewedId: string,
  otherId: string,
): { idA: string; idB: string; roleReadsAToB: boolean } {
  const [idA, idB] = [viewedId, otherId].sort();
  return { idA, idB, roleReadsAToB: viewedId === idA };
}

/**
 * Whether a stored pair's role reads FROM `viewedId` — the reader's half.
 *
 * From the viewed record when it is A and the flag is true, or when it is B and
 * the flag is false: an XNOR, written out because „viewedIsA === roleReadsAToB"
 * is the kind of line a later reader inverts by accident.
 */
export function roleReadsFrom(viewedId: string, idA: string, roleReadsAToB: boolean): boolean {
  const viewedIsA = idA === viewedId;
  return viewedIsA ? roleReadsAToB : !roleReadsAToB;
}
