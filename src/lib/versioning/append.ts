/**
 * Append a version — the one decision, with the database held at arm's length.
 *                                                              (Slice #29.14)
 *
 * WHY THIS EXISTS
 *   Four write paths already made the same decision, spelled out four times:
 *   build a fresh snapshot, read the latest stored version, insert `latest + 1`
 *   only when the two differ (`updateProperty`, `updateDocument`,
 *   `updateNaturalPerson`, `updateJudicialPerson`). Slice #29.14 needed a
 *   FIFTH caller — the bulk re-point on the Reference Data screen, which
 *   rewrites the very columns those snapshots carry — and a fifth copy of a
 *   rule is how the copies start disagreeing. The whole point of the slice is
 *   that a move leaves the trail an ordinary edit leaves, so it has to make
 *   the decision the ordinary edit makes, not one that resembles it.
 *
 *   Hence a port rather than a `tx`: the three things this needs from the
 *   database — build the snapshots, read the latest versions, insert the new
 *   rows — are supplied by the caller as closures over ITS transaction, so the
 *   rule can be tested against plain objects, with no database and no Drizzle
 *   mock. That is what src/__tests__/value-list-move-history.test.ts
 *   exercises.
 *
 * ⚠️ **THE PORT IS SET-SHAPED, AND THAT IS THE WHOLE PERFORMANCE STORY.** The
 * first version of this took one id and the mover looped it. An adversarial
 * round did the arithmetic: five statements per property (three reads to build
 * the snapshot, one for the latest version, one insert) is 25 000 sequential
 * round trips for a 5 000-property move, inside one transaction that holds two
 * lookup rows locked — minutes against a remote Postgres, past any serverless
 * function timeout, on a screen whose previous behaviour was a single UPDATE.
 * Taking a SET means the caller answers all three questions in a fixed number
 * of statements per batch, and the rule below is unchanged either way: it is
 * the same comparison, applied per object.
 *
 * ⚠️ **THE BATCHING LIVES HERE, NOT IN THE CALLER, AND THAT IS DELIBERATE.**
 * These ports bind one parameter per id (`col in ($1, …, $N)`) and four per
 * inserted row, and the Postgres wire protocol carries the parameter count in
 * an Int16 — past 65 535 the Bind message is rejected and the transaction
 * rolls back. An adversarial round pointed out that a bound enforced by the
 * ONE caller that exists today is a bound the next caller will not inherit, so
 * `appendVersionsIfChanged` chunks its own ids and every port sees at most
 * `VERSION_BATCH` of them, whatever it was handed.
 *
 * ⚠️ **EVERY CLOSURE MUST READ AND WRITE THROUGH THE CALLER'S `tx`.** A port
 * whose `buildSnapshots` reads through the global `db` handle would not see
 * the transaction's own uncommitted writes, and would faithfully record the
 * state BEFORE the edit as the version FOR it. `updateJudicialPerson` hit
 * exactly that in Slice #18.05 — see the comment there about
 * `getJudicialPersonById` — and it is the reason the port takes closures
 * rather than ids alone.
 *
 * ⚠️ **`versionNumber` IS PER OBJECT, and there is no batch form.** The
 * version tables carry a UNIQUE index on `(<entity>_id, version_number)`, so
 * "one version for forty moved properties" is not a thing that can be stored.
 * Forty moved properties are forty version rows — the same forty an
 * administrator editing them one at a time would have left. Nothing here
 * defends that index against two writers racing for the same number; what
 * does is that every caller in this repo takes the entity row's own write lock
 * (an UPDATE or an INSERT) before it asks `latestVersions`, which serialises
 * them. A future caller that appends a version WITHOUT writing the entity row
 * first — a "restore this version" button, a bulk import — would be the first
 * one that could collide, and would need its own lock.
 */

/**
 * The database work an entity's version append needs, all through one `tx`.
 *
 * Every method takes or returns the whole set: a caller may answer with one
 * query per satellite table rather than one per object.
 */
export type VersionAppendPort<S> = {
  /**
   * The snapshots as they are NOW, keyed by object id, built from
   * transaction-consistent reads. An id missing from the map is an object that
   * has gone (a concurrent delete) — a skip, not an error.
   */
  buildSnapshots: (ids: readonly string[]) => Promise<Map<string, S>>;
  /** The highest-numbered stored version per id. Missing = no history yet. */
  latestVersions: (
    ids: readonly string[],
  ) => Promise<Map<string, { versionNumber: number; snapshot: S }>>;
  /** Field-by-field, NOT `JSON.stringify` — jsonb does not preserve key order. */
  equal: (a: S, b: S) => boolean;
  /** Insert the rows. `updatedBy` is the acting session's email, or null. */
  insertVersions: (
    rows: ReadonlyArray<{ id: string; versionNumber: number; snapshot: S }>,
    updatedBy: string | null,
  ) => Promise<void>;
};

/**
 * How many objects one round of reads and writes covers.
 *
 * Not tuning for its own sake — it is a correctness bound, and the arithmetic
 * is the point rather than the round number. The largest bind in a batch is
 * the insert, four parameters per row: 4 × 500 = 2 000 against the 65 535 the
 * Bind message can carry, a factor of about 33. (An earlier comment here
 * claimed "three orders of magnitude", which would need a batch of 16 — an
 * adversarial round caught it, and it is the kind of unmeasured number this
 * repo keeps finding.) Memory per batch is roughly 1 000 snapshots, not 500:
 * `buildSnapshots` and `latestVersions` are both live at once.
 */
export const VERSION_BATCH = 500;

/**
 * `items` cut into runs of at most `size`. Exported because the caller that
 * stamps `updated_by` alongside these versions binds one parameter per id too
 * and must cut on the same boundary — one bound, one place.
 */
export function batched<T>(
  items: readonly T[],
  size: number = VERSION_BATCH,
): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * The rule itself, with no I/O in sight — which version number this object
 * should get, or `null` when it should get none.
 *
 * `(latest?.versionNumber ?? -1) + 1` is deliberately the same arithmetic the
 * four edit paths have always used, and the `-1` matters here: the version-0
 * backfills only ever covered rows that existed when their migration ran, so a
 * bulk move CAN meet an object whose history is empty. The alternative to
 * opening it at 0 is silently leaving it empty.
 */
export function nextVersionNumber<S>(
  latest: { versionNumber: number; snapshot: S } | undefined,
  next: S,
  equal: (a: S, b: S) => boolean,
): number | null {
  if (latest && equal(latest.snapshot, next)) return null;
  return (latest?.versionNumber ?? -1) + 1;
}

/**
 * Append a version for each of these objects whose snapshot really changed.
 *
 * Returns how many rows were written — at most `ids.length`, legitimately
 * fewer when a snapshot is identical to the latest stored one (the no-op
 * backstop every edit path already had) or when an object has gone.
 *
 * Ids are used in the order given and are assumed already de-duplicated; the
 * caller knows what its ids mean, and silently collapsing them here would hide
 * a ref that returns several rows per object.
 */
export async function appendVersionsIfChanged<S>(
  port: VersionAppendPort<S>,
  ids: readonly string[],
  updatedBy: string | null,
): Promise<number> {
  let written = 0;

  for (const batch of batched(ids)) {
    const snapshots = await port.buildSnapshots(batch);
    const latest = await port.latestVersions(batch);

    const rows: Array<{ id: string; versionNumber: number; snapshot: S }> = [];
    for (const id of batch) {
      const next = snapshots.get(id);
      if (next === undefined) continue;
      const versionNumber = nextVersionNumber(latest.get(id), next, port.equal);
      if (versionNumber === null) continue;
      rows.push({ id, versionNumber, snapshot: next });
    }

    if (rows.length === 0) continue;
    await port.insertVersions(rows, updatedBy);
    written += rows.length;
  }

  return written;
}
