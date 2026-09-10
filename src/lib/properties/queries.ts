/**
 * DB query helpers for the Property API.
 *
 * Delete: the API path deletes the row (Slice #29.04). Address, corners,
 * versions, junctions and the `property_corner_source` claim all cascade, and
 * the property's `principal_object` row goes with it — see
 * `src/lib/entities/delete.ts`.
 *
 * Corner / address update semantics (replace-all):
 *   When `corners` or `address` is included in the update payload the existing
 *   rows are deleted and the new ones re-inserted. Omitting either key leaves
 *   those rows untouched. Passing address: null deletes the address row.
 */

import { and, count, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db, type DbTransaction } from "@/db";
import { deletePrincipalObjects } from "@/lib/entities/delete";
import { cadastralKey, cadastralValue } from "./cadastral-identity";
import { advisoryLockKeys, type CadastralMatch } from "./import-property-plan";
import { entityMetadata, groupMember, groups, lookupPersonRole, lookupTarla, person, principalObject, property, propertyAddress, propertyCorner, propertyPerson, propertyVersion } from "@/db/schema";
import { appendVersionsIfChanged } from "@/lib/versioning/append";
// Slice #34.07: the snapshot key sets come from the registry that already
// compile-guards them — see SNAPSHOT_PROPERTY_KEYS below.
import {
  PROPERTY_SNAPSHOT_ADDRESS_KEYS,
  PROPERTY_SNAPSHOT_PROPERTY_KEYS,
} from "@/lib/versioning/snapshot-registry";
// Slice #32.14: both derived geometry values come from ONE projection of the
// corners — see that module's header for why they are not two functions.
import { computeCornerGeometry } from "./corner-geometry";
import type {
  PropertyCreate,
  PropertyListQuery,
  PropertySnapshot,
  PropertyUpdate,
} from "./validation";

/**
 * Re-exported so a caller that already imports from this module does not need a
 * second import for the row shape this module returns. It is DEFINED in
 * `./import-property-plan`, which has no database in it — see that header.
 */
export type { CadastralMatch };

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type PropertyListItem = {
  id:               string;
  code:             string;
  nickname:         string | null;
  /**
   * The tarla CODE, read through the FK rather than off the property.
   *                                                            (Slice #34.03)
   * Named `tarla`, not `tarlaSola`, because it is no longer a column on this
   * table: it is `lookup_tarla.indicativ`, reached by LEFT JOIN, and a rename
   * in Reference Data changes it here on the next read. `null` covers both "no
   * tarla" and — impossible under the FK, but free — a dangling id.
   */
  tarla:            string | null;
  parcela:          string | null;
  cadastralNumber:  string | null;
  carteFunciara:    string | null;
  surfaceAreaMp:    string | null;
  calculatedAreaMp: string | null;
  /**
   * Slice #32.14: the corner ORDER traces a self-intersecting ring, so
   * `calculatedAreaMp` beside it is meaningless. Badged on the row.
   */
  cornerOrderSelfIntersects: boolean;
  locality:         string | null;
  county:           string | null;
  /** Metadata fields (always fetched via LEFT JOIN; null when no metadata row exists). */
  importance:       string | null;
  relevance:        string | null;
  provenance:       string | null;
  createdAt:        Date;
  updatedAt:        Date;
};

export type PropertyFull = {
  property: typeof property.$inferSelect;
  address:  typeof propertyAddress.$inferSelect | null;
  corners:  (typeof propertyCorner.$inferSelect)[];
};

// ---------------------------------------------------------------------------
// Version snapshots  (Slice #18.02)
// ---------------------------------------------------------------------------

export type PropertyVersionItem = {
  versionNumber: number;
  snapshot:      PropertySnapshot;
  createdAt:     Date;
};

/** Build the canonical full snapshot from a freshly-fetched PropertyFull. */
export function snapshotFromFull(full: PropertyFull): PropertySnapshot {
  const p = full.property;
  return {
    property: {
      propertyTypeId:  p.propertyTypeId  ?? null,
      nickname:        p.nickname        ?? null,
      // Slice #34.03: the lookup row's ID, like the two ids around it. Old
      // snapshots keep the `tarlaSola` text they were written with; see
      // PropertySnapshotProperty for why nothing rewrites them.
      tarlaId:         p.tarlaId         ?? null,
      parcela:         p.parcela         ?? null,
      cadastralNumber: p.cadastralNumber ?? null,
      carteFunciara:   p.carteFunciara   ?? null,
      useCategoryId:   p.useCategoryId   ?? null,
      // numeric column → drizzle returns string | null; keep as-is.
      surfaceAreaMp:   p.surfaceAreaMp   ?? null,
      // Slice #18.09: derived-but-persisted; included in the snapshot.
      calculatedAreaMp: p.calculatedAreaMp ?? null,
      // ⚠️ Slice #32.14's `cornerOrderSelfIntersects` is DELIBERATELY NOT HERE,
      // and the asymmetry with the line above is the interesting part. The
      // snapshot already carries `corners` IN ORDER, so the flag is recomputable
      // from any version — storing it too would be a derived duplicate free to
      // go stale against the very corners it sits beside. It is also the one
      // read that does not need it: the property form recomputes the marker live
      // from the corners on screen, exactly as it already does the calculated
      // area, so the marker works on a historical version for free. Adding it
      // here would mean touching PropertySnapshotProperty, snapshot-registry's
      // AssertExactKeys and migration_029's backfill for nothing.
      notes:           p.notes           ?? null,
    },
    address: full.address
      ? {
          streetLine: full.address.streetLine ?? null,
          postalCode: full.address.postalCode ?? null,
          locality:   full.address.locality   ?? null,
          county:     full.address.county     ?? null,
          country:    full.address.country,
          notes:      full.address.notes      ?? null,
          // Slice #18.12
          streetViewStreetLine: full.address.streetViewStreetLine ?? null,
        }
      : null,
    corners: full.corners.map((c) => ({
      lat:           c.lat,
      lon:           c.lon,
      originalIndex: c.originalIndex ?? null,
    })),
  };
}

/**
 * The keys `snapshotsEqual` compares — the REGISTRY's arrays, not a second
 * copy of them.                                                (Slice #34.07)
 *
 * ⚠️ **THERE WERE TWO LISTS AND ONLY ONE OF THEM DID ANYTHING.**
 * `snapshot-registry.ts` has held ten property keys since #18.09, guarded both
 * ways by `AssertExactKeys` at compile time and again by
 * `snapshot-registry.test.ts` at run time. This file held nine, hand-written,
 * guarded by nothing — and this file's copy is the one `snapshotsEqual` reads.
 * The missing key was `calculatedAreaMp`: `snapshotFromFull` above writes it
 * into every snapshot, the registry says it belongs there, and the comparison
 * that decides whether a version row is written skipped it.
 *
 * ⚠️ **An earlier draft of this paragraph gave three examples of a save that
 * would change the area and nothing else, and a review round showed that all
 * three were impossible** — worth recording, because the exercise is what
 * establishes how narrow the live effect is (next paragraph but one).
 * Re-ordering corners and straightening a bow-tie both rewrite
 * `property_corner.sequence_no`, which the snapshot carries IN ORDER, so those
 * saves compared unequal already; and `scripts/mark-bow-tie-properties.ts`
 * writes `corner_order_self_intersects` and nothing else, by its own header's
 * design — it computes an area only to print it in the dry run. Nothing in the
 * application changes a property's area while its corners stand still.
 *
 * The registry's whole premise is that it is the single source; it could not
 * be while the comparison kept its own list. Pointing at it costs one import
 * and makes the compile-time guard load-bearing for this code too: a field
 * added to `PropertySnapshotProperty` now fails `AssertExactKeys` until the
 * registry names it, and naming it there is what puts it here.
 *
 * ⚠️ **WHAT THIS ACTUALLY CHANGES AT RUN TIME: almost nothing, and this
 * paragraph has now been wrong twice, so it is written from the mechanism
 * rather than from intuition.**
 *
 * `snapshotsEqual` is only ever consulted when there IS a stored version to
 * compare against — `nextVersionNumber` (src/lib/versioning/append.ts) returns
 * a number without calling `equal` at all when an object has no history. So
 * the stricter comparison cannot reach an object with no version rows, which
 * rules out `seed_dev_data.sql`'s properties outright: it truncates
 * `property_version` and writes none. (`src/db/seed.ts`'s rows were in the
 * same position until this slice and are now in a different one: they have a
 * version 0, and it carries the key, so they are unaffected for the ordinary
 * reason rather than the structural one. The first draft of this note named
 * both seeds as the AFFECTED population, which is backwards twice over.)
 *
 * For a property that does have history, the new key decides the outcome only
 * when every OTHER compared field is equal and `calculatedAreaMp` is not. That
 * means a stored snapshot written before Slice #18.09 put the field into
 * `snapshotFromFull` — `migration_029_property_versions.sql`'s backfill, and
 * every version the application itself wrote between #18.02 and #18.09, which
 * carry the identical key set. It is narrow, because such a snapshot also
 * carries `tarlaSola` rather than `tarlaId` and no `streetViewStreetLine` at
 * all, so a property with a tarla, or with an address row, already compared
 * unequal on one of those. What is left is a property with THREE OR MORE
 * corners (below three there is no area on either side, and `?? null` makes
 * them equal — the same floor migration_033's backfill used), no tarla and no
 * address, not saved since #18.09: it now records one version on its next save.
 *
 * ⚠️ **AND IT DOES NOT CHANGE THE BULK RE-POINT'S COST**, which a second draft
 * of this note claimed it did. `recordMoveHistory` is handed exactly the ids
 * `moveRef`'s `UPDATE … RETURNING` returned — objects whose moved column just
 * changed — and every versioned ref moves a column that is inside the
 * snapshot. Each of them was already unequal and already got a version row.
 * Stated in the negative deliberately: it is a cost somebody would otherwise
 * budget for before running a move on a large archive.
 *
 * So the value here is forward-looking rather than corrective. What the change
 * buys is that the guard exists at all: the next field added to
 * `PropertySnapshotProperty` cannot be written into every snapshot and
 * compared in none, because `AssertExactKeys` now fails until the registry
 * names it, and naming it there is what puts it here.
 *
 * The ADDRESS array below is the same registry array and, today, the same
 * seven keys in the same order — a no-op, taken for the same reason: two lists
 * of one fact drift, and the property one is proof that they drift silently.
 *
 * The corner loop is left comparing its three fields by hand: it also has to
 * pair rows up by index and read `?? null` on `originalIndex`, so there is no
 * key array to drive it with. `PROPERTY_SNAPSHOT_CORNER_KEYS` names exactly
 * those three, which is what makes the hand-written loop checkable by eye.
 */
const SNAPSHOT_PROPERTY_KEYS: ReadonlyArray<keyof PropertySnapshot["property"]> =
  PROPERTY_SNAPSHOT_PROPERTY_KEYS;
const SNAPSHOT_ADDRESS_KEYS: ReadonlyArray<keyof NonNullable<PropertySnapshot["address"]>> =
  PROPERTY_SNAPSHOT_ADDRESS_KEYS;

/**
 * Field-by-field equality of two snapshots. Used to skip writing a new version
 * when a save produced no actual change (the form's dirty-gate already mostly
 * prevents this; this is the backstop). Compared explicitly rather than via
 * JSON.stringify because Postgres jsonb does not preserve object key order.
 */
function snapshotsEqual(a: PropertySnapshot, b: PropertySnapshot): boolean {
  for (const k of SNAPSHOT_PROPERTY_KEYS) {
    // ⚠️ **`?? null`, so an ABSENT key and an explicit `null` are the same
    // fact.**                                                (Slice #34.03)
    // A review round found this: snapshots written before migration_078 carry
    // `tarlaSola` and no `tarlaId`, so a strict `!==` reads `undefined` vs
    // `null` as a change and writes a spurious version row for a property that
    // never had a tarla at all — every one of them, on its first save after
    // the slice. A property that DID have one gets a version, and that is
    // honest: what it stores really did change. The corner loop below has read
    // `?? null` since #18.11 for the same reason, on the same shape of
    // problem.
    if ((a.property[k] ?? null) !== (b.property[k] ?? null)) return false;
  }
  if ((a.address === null) !== (b.address === null)) return false;
  if (a.address && b.address) {
    for (const k of SNAPSHOT_ADDRESS_KEYS) {
      if (a.address[k] !== b.address[k]) return false;
    }
  }
  if (a.corners.length !== b.corners.length) return false;
  for (let i = 0; i < a.corners.length; i++) {
    if (a.corners[i].lat !== b.corners[i].lat) return false;
    if (a.corners[i].lon !== b.corners[i].lon) return false;
    if ((a.corners[i].originalIndex ?? null) !== (b.corners[i].originalIndex ?? null)) {
      return false;
    }
  }
  return true;
}

/**
 * The properties as they stand inside `tx`, for snapshots.      (Slice #29.14)
 *
 * ⚠️ **THREE QUERIES FOR THE WHOLE SET, NOT THREE PER PROPERTY, AND AN
 * ADVERSARIAL ROUND IS WHY.** The first draft of the bulk re-point rebuilt one
 * snapshot at a time — these three reads per property, plus the latest-version
 * read and the insert in `recordPropertyVersionsIfChanged` below, so five
 * statements each and 25 000 sequential round trips for a 5 000-property move,
 * inside one transaction holding two lookup rows locked. That is minutes
 * against a remote Postgres and past any serverless timeout, on a screen whose
 * previous behaviour was a single UPDATE. Set-shaped reads are what make the
 * history affordable.
 *
 * ⚠️ **Reads through `tx`, and it has to.** Through the global `db` handle it
 * would not see the caller transaction's uncommitted writes and would record
 * the state BEFORE the change as the version FOR it — the trap Slice #18.05
 * documented for the judicial half.
 */
async function propertyFullsIn(
  tx: DbTransaction,
  ids: readonly string[],
): Promise<Map<string, PropertyFull>> {
  const idList = [...ids];
  if (idList.length === 0) return new Map();

  const props = await tx
    .select()
    .from(property)
    .where(inArray(property.id, idList));

  const addrs = await tx
    .select()
    .from(propertyAddress)
    .where(inArray(propertyAddress.propertyId, idList));

  // Ordered by property first so the per-property runs are contiguous, then by
  // `sequenceNo` — the corner order IS data (the polygon), not a display
  // preference, and `snapshotFromFull` stores it as given.
  const corners = await tx
    .select()
    .from(propertyCorner)
    .where(inArray(propertyCorner.propertyId, idList))
    .orderBy(propertyCorner.propertyId, propertyCorner.sequenceNo);

  const addrById = new Map(addrs.map((a) => [a.propertyId, a]));
  const cornersById = new Map<string, (typeof propertyCorner.$inferSelect)[]>();
  for (const c of corners) {
    const list = cornersById.get(c.propertyId);
    if (list) list.push(c);
    else cornersById.set(c.propertyId, [c]);
  }

  return new Map(
    props.map((p) => [
      p.id,
      {
        property: p,
        address: addrById.get(p.id) ?? null,
        corners: cornersById.get(p.id) ?? [],
      },
    ]),
  );
}

/**
 * Append versions for these properties, where the snapshot really changed.
 *                                                              (Slice #29.14)
 *
 * The comparison `updateProperty` makes, callable by anything else that
 * rewrites properties inside a transaction — today the bulk re-point on the
 * Reference Data screen, which moves `property_type_id`, `use_category_id` and
 * `tarla_id` (`tarla_sola` until Slice #34.03), all three of them inside the
 * snapshot. Before #29.14 that move
 * wrote no version at all, so the type change surfaced in the NEXT ordinary
 * edit's diff, under whoever made that edit.
 *
 * `prebuilt` is for the caller that has already built its snapshots —
 * `updatePropertyIn` re-fetches the whole record anyway, and paying for a
 * second identical read would be the only cost of sharing this rule with it.
 * Returns how many version rows were written.
 */
export async function recordPropertyVersionsIfChanged(
  tx: DbTransaction,
  ids: readonly string[],
  updatedBy: string | null,
  prebuilt?: ReadonlyMap<string, PropertySnapshot>,
): Promise<number> {
  return appendVersionsIfChanged<PropertySnapshot>(
    {
      buildSnapshots: async (batch) => {
        // Scoped to the batch rather than returned whole, and an adversarial
        // round is why: `appendVersionsIfChanged` cuts its own ids into
        // batches, and a caller that hands over a whole-set `prebuilt` with a
        // chunked `ids` would otherwise have every batch after the first
        // quietly write the FIRST batch's snapshots. Today's four callers pass
        // exactly one id, so this changes nothing for them and everything for
        // the next one.
        if (prebuilt) {
          return new Map(
            batch
              .filter((id) => prebuilt.has(id))
              .map((id) => [id, prebuilt.get(id)!] as const),
          );
        }
        const fulls = await propertyFullsIn(tx, batch);
        return new Map(
          [...fulls].map(([id, full]) => [id, snapshotFromFull(full)]),
        );
      },
      latestVersions: async (batch) => {
        const idList = [...batch];
        if (idList.length === 0) return new Map();
        // DISTINCT ON + the matching ORDER BY is "the newest row per property"
        // in one query. The ORDER BY is not cosmetic: DISTINCT ON keeps the
        // FIRST row of each group, so dropping `desc(versionNumber)` would
        // silently compare against version 0 forever.
        const rows = await tx
          .selectDistinctOn([propertyVersion.propertyId], {
            propertyId:    propertyVersion.propertyId,
            versionNumber: propertyVersion.versionNumber,
            snapshot:      propertyVersion.snapshot,
          })
          .from(propertyVersion)
          .where(inArray(propertyVersion.propertyId, idList))
          .orderBy(propertyVersion.propertyId, desc(propertyVersion.versionNumber));
        return new Map(
          rows.map((r) => [
            r.propertyId,
            {
              versionNumber: r.versionNumber,
              snapshot: r.snapshot as PropertySnapshot,
            },
          ]),
        );
      },
      equal: snapshotsEqual,
      insertVersions: async (rows, by) => {
        await tx.insert(propertyVersion).values(
          rows.map((r) => ({
            propertyId:    r.id,
            versionNumber: r.versionNumber,
            snapshot:      r.snapshot,
            updatedBy:     by,
          })),
        );
      },
    },
    ids,
    updatedBy,
  );
}

/** All versions of a property, oldest (version 0) first. */
export async function listPropertyVersions(
  propertyId: string,
): Promise<PropertyVersionItem[]> {
  const rows = await db
    .select({
      versionNumber: propertyVersion.versionNumber,
      snapshot:      propertyVersion.snapshot,
      createdAt:     propertyVersion.createdAt,
    })
    .from(propertyVersion)
    .where(eq(propertyVersion.propertyId, propertyId))
    .orderBy(propertyVersion.versionNumber);

  return rows.map((r) => ({
    versionNumber: r.versionNumber,
    snapshot:      r.snapshot as PropertySnapshot,
    createdAt:     r.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listProperties(opts: PropertyListQuery): Promise<{
  items: PropertyListItem[];
  total: number;
}> {
  const q   = opts.q?.trim();
  const pat = q ? `%${q}%` : null;

  // Slice #18.17: Groups filter.
  // groupCodes undefined → no filter.
  // groupCodes []       → show properties with no PROPERTY group only.
  // groupCodes [...]    → filter to those codes; also include ungrouped unless
  //                       opts.includeUngrouped is explicitly false.
  // NOTE: ${property.id} inside a correlated sql`` subquery renders UNQUALIFIED
  // ("id"), which Postgres resolves to g_f.id (groups alias) instead of the
  // outer property.id. Use the literal qualified name instead (CLAUDE.md gotcha).
  let groupFilter: ReturnType<typeof sql> | undefined = undefined;
  if (opts.groupCodes !== undefined) {
    const hasNoGroup = sql`NOT EXISTS (
      SELECT 1 FROM ${groupMember} gm_f
      JOIN ${groups} g_f ON g_f.id = gm_f.group_id
      WHERE gm_f.principal_object_id = property.principal_object_id
        AND g_f.target_type = 'PROPERTY'
    )`;
    const hasMatchingCode = sql`EXISTS (
      SELECT 1 FROM ${groupMember} gm_f2
      JOIN ${groups} g_f2 ON g_f2.id = gm_f2.group_id
      WHERE gm_f2.principal_object_id = property.principal_object_id
        AND g_f2.target_type = 'PROPERTY'
        AND g_f2.code = ANY(ARRAY[${sql.join(
          opts.groupCodes.map((c) => sql`${c}`),
          sql`, `,
        )}]::text[])
    )`;
    if (opts.groupCodes.length === 0 && opts.includeUngrouped === false) {
      // Nothing selected → show nothing.
      groupFilter = sql`1 = 0`;
    } else if (opts.groupCodes.length === 0) {
      // "Not in a group" only.
      groupFilter = hasNoGroup;
    } else if (opts.includeUngrouped === false) {
      // Codes only — exclude ungrouped items.
      groupFilter = hasMatchingCode;
    } else {
      // Codes + ungrouped (default: includeUngrouped is true/undefined).
      groupFilter = sql`(${hasNoGroup} OR ${hasMatchingCode})`;
    }
  }

  const where = and(
    pat
      ? or(
          ilike(property.code,            pat),
          ilike(property.nickname,        pat),
          ilike(property.cadastralNumber, pat),
          ilike(property.carteFunciara,   pat),
          // Slice #34.03: the code lives one table over now. The LEFT JOIN
          // below is what makes this reachable; on a property with no tarla
          // `indicativ` is NULL and `ilike` is NULL, which `or` treats as
          // "no match" — the same answer the old NULL `tarla_sola` gave.
          ilike(lookupTarla.indicativ,    pat),
          ilike(property.parcela,         pat),
        )
      : undefined,
    groupFilter,
    // Slice #20.06: metadata filters.
    opts.importance ? eq(entityMetadata.importance, opts.importance) : undefined,
    opts.relevance  ? eq(entityMetadata.relevance,  opts.relevance)  : undefined,
  );

  const [items, totals] = await Promise.all([
    db
      .select({
        id:              property.id,
        code:            property.code,
        nickname:        property.nickname,
        tarla:           lookupTarla.indicativ,
        parcela:         property.parcela,
        cadastralNumber: property.cadastralNumber,
        carteFunciara:   property.carteFunciara,
        surfaceAreaMp:   property.surfaceAreaMp,
        calculatedAreaMp: property.calculatedAreaMp,
        cornerOrderSelfIntersects: property.cornerOrderSelfIntersects,
        locality:        propertyAddress.locality,
        county:          propertyAddress.county,
        importance:      entityMetadata.importance,
        relevance:       entityMetadata.relevance,
        provenance:      entityMetadata.provenance,
        createdAt:       property.createdAt,
        updatedAt:       property.updatedAt,
      })
      .from(property)
      // Slice #34.03: LEFT, not inner - three of fourteen properties carry no
      // tarla and an inner join would drop them from the list entirely.
      .leftJoin(lookupTarla, eq(lookupTarla.id, property.tarlaId))
      .leftJoin(
        propertyAddress,
        eq(propertyAddress.propertyId, property.id),
      )
      .leftJoin(
        entityMetadata,
        eq(entityMetadata.principalObjectId, property.principalObjectId),
      )
      .where(where)
      // Slice #16.UX.01: most-recently modified/created first.
      .orderBy(sql`greatest(${property.updatedAt}, ${property.createdAt}) desc`)
      .limit(opts.limit)
      .offset(opts.offset),

    db
      .select({ total: count() })
      .from(property)
      // ⚠️ Slice #34.03: this join is NOT optional and is not symmetry with the
      // query above. Both halves share one `where`, and that `where` now names
      // `lookupTarla.indicativ` for the free-text search - so without the join
      // here the COUNT is a 42P01 on a table the query never mentioned, and
      // only when the user types something. The same trap the comment below
      // records for entityMetadata, one slice later.
      .leftJoin(lookupTarla, eq(lookupTarla.id, property.tarlaId))
      // Slice #20.06: must join entityMetadata when importance/relevance filter active.
      .leftJoin(
        entityMetadata,
        eq(entityMetadata.principalObjectId, property.principalObjectId),
      )
      .where(where),
  ]);

  return { items: items as PropertyListItem[], total: totals[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Get by id (full record: property + address + ordered corners)
// ---------------------------------------------------------------------------

export async function getPropertyById(
  id: string,
): Promise<PropertyFull | null> {
  const propRows = await db
    .select()
    .from(property)
    .where(eq(property.id, id))
    .limit(1);

  if (propRows.length === 0) return null;

  const [addrRows, cornerRows] = await Promise.all([
    db
      .select()
      .from(propertyAddress)
      .where(eq(propertyAddress.propertyId, id))
      .limit(1),
    db
      .select()
      .from(propertyCorner)
      .where(eq(propertyCorner.propertyId, id))
      .orderBy(propertyCorner.sequenceNo),
  ]);

  return {
    property: propRows[0],
    address:  addrRows[0] ?? null,
    corners:  cornerRows,
  };
}

// ---------------------------------------------------------------------------
// Find by cadastral identity  (Slice #26.07)
// ---------------------------------------------------------------------------

/**
 * Every non-deleted Property whose tarla and parcela mean the same parcel.
 *
 * **Returns a LIST, and that is not defensive typing.** Nothing in the database
 * stops two Properties carrying one identity, and until this slice nothing
 * stopped the import creating them — the create path had, in its own comment,
 * "nothing to deduplicate against", so an archive imported twice already holds
 * pairs. A function that returned the first row would pick one of them by
 * `code` order and link a folder's documents to it silently, which is the
 * failure this slice exists to end rather than to automate. The caller shows
 * the user what it found.
 *
 * ⚠️ **The comparison is in JavaScript, over every candidate row, on purpose.**
 * The obvious alternative is a `WHERE` clause that normalises both sides in
 * SQL — and that is a SECOND implementation of "same parcel", free to disagree
 * with `cadastralIdentityKey` about a space or a diacritic, in the one place
 * where disagreeing means creating a duplicate. `cadastralIdentityKey` is the
 * only answer to that question in this codebase (STR-03 uses it too), and
 * keeping it that way costs a scan of three columns of a table that holds one
 * business user's parcels. The SQL still does the part it cannot get wrong:
 * only rows carrying BOTH identifiers can match anything, so only those are
 * fetched.
 */
export async function findPropertiesByCadastralIdentity(
  tx: DbTransaction,
  tarlaSola: string,
  parcela: string,
): Promise<CadastralMatch[]> {
  // ⚠️ The two halves are compared SEPARATELY, never through a joined key, and
  // an adversarial round is what put them that way. `cadastralIdentityKey`
  // joins with `-` and argues that neither half can contain one — true of every
  // value the property-folder grammar produces, and NOT true of the rows this
  // query reads, which include whatever a user typed into the Property form.
  // Joined, `("47", "2-225/3")` and `("47-2", "225/3")` are one identity: two
  // legitimate parcels would come back as a pair, the plan would report
  // `ambiguous`, and a business user would be told to delete one of them.
  // Field against field, there is nothing for a separator to be ambiguous in.
  const wantedTarla = cadastralKey(tarlaSola);
  const wantedParcela = cadastralKey(parcela);

  // ⚠️ Slice #34.03: the tarla half comes through a JOIN now, and the
  // comparison stays exactly where it was - in JavaScript, over
  // `cadastralKey`. It would be tempting, with the code in a lookup table, to
  // resolve the wanted tarla to an id first and compare ids: one indexed
  // equality instead of a scan. That is the SECOND implementation of "same
  // parcel" this function's header refuses, and it would disagree with
  // `cadastralKey` on the day it matters - an id comparison cannot see that
  // `50 D` and `50D` are one parcel, and the import's whole job is to find the
  // property again next month whatever a person typed. The join fetches the
  // code; `cadastralKey` still decides.
  //
  // ⚠️ LEFT rather than INNER changes nothing here, and a review round is why
  // that is said instead of a reason that merely sounded better:
  // `isNotNull(tarlaId)` plus the foreign key already guarantee the join finds
  // exactly one row, so the two forms return the same rows. It is LEFT for
  // consistency with the other two joins on this table, and so that relaxing
  // the `isNotNull` later cannot silently start dropping properties. What
  // narrows the scan is the WHERE below.
  const candidates = await tx
    .select({
      id: property.id,
      code: property.code,
      nickname: property.nickname,
      principalObjectId: property.principalObjectId,
      tarla: lookupTarla.indicativ,
      parcela: property.parcela,
    })
    .from(property)
    .leftJoin(lookupTarla, eq(lookupTarla.id, property.tarlaId))
    .where(
      and(
        isNotNull(property.tarlaId),
        isNotNull(property.parcela),
      ),
    )
    .orderBy(property.code);

  const hits = candidates.filter(
    (row) =>
      cadastralKey(row.tarla ?? "") === wantedTarla &&
      cadastralKey(row.parcela ?? "") === wantedParcela,
  );
  if (hits.length === 0) return [];

  const counts = await tx
    .select({ propertyId: propertyCorner.propertyId, n: count() })
    .from(propertyCorner)
    .where(inArray(propertyCorner.propertyId, hits.map((h) => h.id)))
    .groupBy(propertyCorner.propertyId);

  const byId = new Map(counts.map((c) => [c.propertyId, c.n]));
  return hits.map((h) => ({ ...h, cornerCount: byId.get(h.id) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createProperty(
  input: PropertyCreate,
  updatedBy: string | null = null,
): Promise<PropertyFull> {
  return await db.transaction((tx) => createPropertyIn(tx, input, updatedBy));
}

/**
 * The tarla row this create is for: the one a person picked, or the one a
 * machine's code names — finding it, or making it.            (Slice #34.03)
 *
 * ⚠️ **THIS IS THE ONLY PLACE THAT CAN MINT A `lookup_tarla` ROW OUTSIDE THE
 * ADMIN MODAL, AND THE `IMPORT` LITERAL LIVES INSIDE THE `tarlaCode` BRANCH
 * FOR THAT REASON.** migration_077 made `origin` a property of the WRITE SITE
 * rather than a field a payload could claim; #34.03 keeps that and makes it
 * structural instead of argued. Before this slice the property held free text
 * and one field served both clients, so the write site had to reason about who
 * it was talking to — migration_077's header spends four paragraphs proving
 * that only an import could reach the seed, ending in a warning that a
 * create-mode prefill on the Property form would silently break the proof.
 * Two fields close that: `tarlaId` is a row somebody chose and cannot create
 * anything; `tarlaCode` is a string a machine parsed and is the only door to
 * the INSERT. A prefill on the form would now be a prefill of an ID.
 *
 * ⚠️ **THE MATCH IS `cadastralKey`, IN JAVASCRIPT, OVER EVERY ROW — the same
 * shape and the same reason as `findPropertiesByCadastralIdentity` above.** It
 * would be one indexed equality to ask SQL for `indicativ = code`, and that is
 * what this did before #34.03; it is also how the folded twin gets made. An
 * import carrying `t3` finds no exact `T3`, inserts a second row, and the list
 * now holds two codes that mean one tarla with properties pointing at both —
 * which is the pair problem migration_078 REFUSES to resolve, manufactured by
 * the application the day after the migration ran. `cadastralKey` is this
 * codebase's one answer to "are these two cadastral identifiers the same" and
 * it is the answer here too; `lookup_tarla` holds a few dozen rows, so the
 * scan costs nothing.
 *
 * ⚠️ **It is deliberately LOOSER than migration_078's fold, which is
 * `foldRomanian` alone.** The migration is stricter because it must REFUSE
 * rather than choose: it resolves against the exact fold `decision-checks.sql`
 * measured the database with, so it never places a property on evidence nobody
 * looked at. This function must CHOOSE, and choosing `47/2` for a code written
 * `47per2` is right — it is the same parcel to everyone except a string
 * comparison. Looser here can only ever create FEWER rows than the migration
 * would, never a twin the migration would have refused.
 *
 * `tarlaId` wins over `tarlaCode` when both arrive: an id is a decision.
 *
 * ⚠️ **THE FOLD CLOSES THE SPELLING HALF; SLICE #34.14 CLOSES THE CONCURRENCY
 * HALF, AND THE TWO ARE DIFFERENT BUGS.** Read-all-rows, find, insert is not
 * atomic. Two creates carrying the same NEW code could interleave, both miss,
 * and both insert — producing exactly the twin pair migration_078 refuses to
 * resolve, with properties pointing at both rows and #34.03's `ambiguous-value`
 * refusal no longer downstream to catch it. The import's own advisory lock does
 * not cover this: it keys on the cadastral IDENTITY (`tarla-parcela`), so two
 * folders sharing a tarla take DIFFERENT locks, and `POST /api/properties`
 * takes no identity lock at all. (It takes the CODE lock below — that is what
 * this slice adds; before it, that door was unserialised in both senses.)
 *
 * **So this function takes its own lock, on the FOLDED CODE, and it takes it
 * only when it is about to insert.** `pg_advisory_xact_lock` inside the
 * transaction the caller already opened: no migration, no schema object,
 * released by the commit or the rollback whatever happens in between. The
 * pattern is double-checked — scan, and only on a MISS take the lock and scan
 * again — for two reasons, neither of them micro-optimisation:
 *   • a transaction-scoped lock is held until COMMIT, so locking on every
 *     create would serialise every folder of an import that shares one tarla
 *     against every other, for the whole of each transaction;
 *   • the second scan is what makes the lock mean anything. The racer that got
 *     there first commits, we take the lock it released, we look again, and we
 *     ADOPT its row instead of writing a twin.
 *
 * **The key is `advisoryLockKeys("tarla:" + wanted)`** — the same hash pair
 * `ensurePropertyForFolder` uses, over a NAMESPACED string so a tarla lock and
 * a parcel-identity lock can never be the SAME STRING. (Not "can never
 * collide": these are two 32-bit hashes and `advisoryLockKeys`'s own header
 * concedes that a hash collision costs a wait and nothing else. What the prefix
 * removes is the case where the two are equal by construction — a hyphenated
 * code like `48-50d`, which `POST /api/properties` accepts as free text, is
 * character for character the identity of tarla `48`, parcela `50d`.) It reuses
 * that function rather than copying it for the reason stated there: a hash
 * computed in this codebase cannot drift out from under the code that depends
 * on it.
 *
 * ⚠️ **NO DEADLOCK, AND IT IS ORDERING THAT BUYS THAT, NOT LUCK.** The only
 * caller that holds a parcel-identity lock takes it BEFORE `createPropertyIn`
 * runs, so the acquisition order is always identity-then-code; nothing anywhere
 * takes a tarla lock and then waits for an identity one. Two transactions
 * wanting the same new code simply queue.
 *
 * ⚠️ **WHAT THE LOCK DOES NOT COVER, NAMED RATHER THAN IMPLIED.** It
 * serialises this function against itself, and this function is the only door
 * that MINTS a code from a folder name. The other writer of `lookup_tarla` is
 * Reference Data's „Adaugă", through `createValue` — which takes no lock and
 * applies no fold, so an administrator typing `t3` beside an existing `T3`
 * still makes the twin pair, with or without a race. That gap is older than
 * this slice and is the one a unique index would close; it is in the #34.14
 * handover rather than papered over here.
 *
 * A unique index over the folded `indicativ` would close both at the database.
 * That remains the follow-up migration_078's header declines for its own
 * reasons — an admin form's second „T1" would become a 23505 needing a friendly
 * refusal per outcome, which is a slice, not a line.
 */
async function resolveTarlaForCreate(
  tx: DbTransaction,
  input: { tarlaId?: string | null; tarlaCode?: string | null },
): Promise<string | null> {
  if (input.tarlaId) return input.tarlaId;
  const raw = input.tarlaCode?.trim();
  if (!raw) return null;

  // `cadastralValue` before anything is stored, so a row this creates holds the
  // decoded `47/2` and not the folder's `47per2` — the rule
  // cadastral-identity.ts's header states, applied at the one write site that
  // can put a code into the list without a person seeing it.
  const value = cadastralValue(raw);
  const wanted = cadastralKey(value);
  if (wanted === "") return null;

  // The scan is a helper rather than two copies, because the SECOND scan
  // deciding differently from the first — a looser fold, a stale `wanted` — is
  // the one way this pattern fails silently: it would insert the twin the lock
  // was taken to prevent, under the lock, and look correct doing it.
  //
  // ⚠️ **`id` IS THE SECOND SORT TERM, AND ON THIS READ IT IS NOT COSMETIC.**
  // (Slice #34.14.) `indicativ` has no unique constraint — the header above
  // names the writer that can still make a twin pair with no race at all,
  // Reference Data's „Adaugă", which applies no fold — so `ORDER BY indicativ`
  // alone leaves `rows.find` picking whichever of two identical codes Postgres
  // handed over first. That pick is not a row's position on a screen: it is
  // written into `property.tarla_id`, a foreign key, so two creates of one code
  // could point at two different rows, and every count, move and delete in
  // Reference Data would then see two populations where there is one code.
  // Same one-line fix as the nine `listValues` branches, on the read where
  // being wrong is persisted rather than displayed.
  const findFolded = async (): Promise<string | null> => {
    const rows = await tx
      .select({ id: lookupTarla.id, indicativ: lookupTarla.indicativ })
      .from(lookupTarla)
      .orderBy(lookupTarla.indicativ, lookupTarla.id);
    return rows.find((r) => cadastralKey(r.indicativ) === wanted)?.id ?? null;
  };

  const hit = await findFolded();
  if (hit) return hit;

  // ── About to mint a code: serialise on it first. ─────────  (Slice #34.14)
  //
  // Namespaced, so this lock cannot collide with `ensurePropertyForFolder`'s
  // lock on a cadastral identity. See the header above for the double check,
  // the ordering that rules out a deadlock, and why the lock is not taken on
  // the hit path.
  const [lockA, lockB] = advisoryLockKeys(`tarla:${wanted}`);
  await tx.execute(sql`select pg_advisory_xact_lock(${lockA}::int4, ${lockB}::int4)`);

  // The second half of the double check. A racer that committed its row while
  // we waited for the lock is ADOPTED here rather than duplicated.
  //
  // ⚠️ **THIS SCAN SEES THE RACER ONLY BECAUSE `db.transaction()` IS READ
  // COMMITTED** — a bare `BEGIN`, so every statement takes its own snapshot.
  // Raise the isolation level and this re-read would reuse the snapshot the
  // FIRST scan took, miss the committed row, and insert the twin under the lock
  // that was taken to prevent it. Stated because it is invisible: the code
  // would look exactly the same and be exactly wrong.
  const raced = await findFolded();
  if (raced) return raced;

  // ⚠️ The origin literal is written HERE and takes no parameter, so no caller
  // can express one and no sixth caller can forget it. See migration_077.
  const [created] = await tx
    .insert(lookupTarla)
    .values({ indicativ: value, origin: "IMPORT" })
    .returning({ id: lookupTarla.id });
  return created.id;
}

/**
 * The same create, inside a transaction the CALLER opened.   (Slice #26.07)
 *
 * `createProperty` above is this function plus a transaction, and it is still
 * what every route calls. This one exists because #26.07's import path has to
 * do "look for a matching property, and create one only if there is none"
 * without a second request slipping between the two halves — which means the
 * lookup and the create must sit in one transaction, under one advisory lock,
 * opened by the caller.
 *
 * The alternative was to let `createProperty` open its own transaction on a
 * second pooled connection while the caller's was still open. That works —
 * the inner commit happens before the outer one, so the lock is still held
 * when the row lands — but it holds two connections per create, and a pool
 * with `max: 10` is a deadlock waiting for a busy afternoon. Splitting the
 * function costs one line and removes the shape entirely.
 */
export async function createPropertyIn(
  tx: DbTransaction,
  input: PropertyCreate,
  updatedBy: string | null = null,
): Promise<PropertyFull> {
  const { address: addrInput, corners: cornerList, ...propFields } = input;
  const createGeometry = computeCornerGeometry(cornerList);

  {
    // Allocate a code from the shared sequence via the principal_object row.
    const [poRow] = await tx
      .insert(principalObject)
      .values({
        objectType: "PROPERTY",
        code: sql`'PROP' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
      })
      .returning();

    // Slice #34.03: resolved BEFORE the property row, because the property now
    // holds the id. The seed used to run after the insert, which was fine when
    // it only had to make the dropdown offer a string the property already
    // carried; it cannot be after any more.
    const tarlaId = await resolveTarlaForCreate(tx, propFields);

    const [propRow] = await tx
      .insert(property)
      .values({
        principalObjectId: poRow.id,
        code:            poRow.code,
        propertyTypeId:  propFields.propertyTypeId  ?? null,
        nickname:        propFields.nickname        ?? null,
        tarlaId,
        parcela:         propFields.parcela         ?? null,
        cadastralNumber: propFields.cadastralNumber ?? null,
        carteFunciara:   propFields.carteFunciara   ?? null,
        useCategoryId:   propFields.useCategoryId   ?? null,
        surfaceAreaMp:   propFields.surfaceAreaMp != null
                           ? String(propFields.surfaceAreaMp)
                           : null,
        // Slice #18.09 / #32.14: both computed from the corners supplied at
        // creation, in one projection. This is one of the two choke points
        // every corner write passes through — the property form save, POST
        // /api/properties, the document process route, the import and the
        // calculation commit all arrive here, and none of them knows the
        // bow-tie flag exists.
        calculatedAreaMp:          createGeometry.calculatedAreaMp,
        cornerOrderSelfIntersects: createGeometry.selfIntersects,
        notes:           propFields.notes           ?? null,
        updatedBy,
      })
      .returning();

    let addrRow: typeof propertyAddress.$inferSelect | null = null;
    if (addrInput) {
      const [a] = await tx
        .insert(propertyAddress)
        .values({
          propertyId:  propRow.id,
          streetLine:  addrInput.streetLine  ?? null,
          postalCode:  addrInput.postalCode  ?? null,
          locality:    addrInput.locality    ?? null,
          county:      addrInput.county      ?? null,
          country:     addrInput.country,
          notes:       addrInput.notes       ?? null,
          streetViewStreetLine: addrInput.streetViewStreetLine ?? null,
        })
        .returning();
      addrRow = a;
    }

    let cornerRows: (typeof propertyCorner.$inferSelect)[] = [];
    if (cornerList.length > 0) {
      cornerRows = await tx
        .insert(propertyCorner)
        .values(
          cornerList.map((c, i) => ({
            propertyId: propRow.id,
            sequenceNo: i + 1,
            lat:        c.lat,
            lon:        c.lon,
            originalIndex: c.originalIndex ?? null,
          })),
        )
        .returning();
    }

    const full: PropertyFull = { property: propRow, address: addrRow, corners: cornerRows };

    // Slice #18.02: record version 0 — the state at creation.
    await tx.insert(propertyVersion).values({
      propertyId:    propRow.id,
      versionNumber: 0,
      snapshot:      snapshotFromFull(full),
      updatedBy,
    });

    // Auto-seed lookup_tarla: if the imported tarla value (e.g. "47/2") is not
    // already in the reference table, add it so it appears in the form dropdown.
    // Idempotent — skipped when the indicativ already exists.
    //
    // ── Slice #34.02 / #34.03: where the auto-seed went ─────────────────────
    //
    // It used to be HERE, after the property row, because the property carried
    // the tarla as TEXT and the seed existed only so the dropdown would offer
    // a string that was already on the property. #34.03 made the property hold
    // the id, so the seed has to run before the insert and is now
    // `resolveTarlaForCreate` above. Everything #34.02 argued about it holds
    // there instead, and one thing got stronger: the `IMPORT` literal sits in
    // a branch reached only by `tarlaCode`, a field the Property form does not
    // send, so "only an import can mint a code" stopped being a claim about
    // five call sites and became a claim about one type.
    //
    // ⚠️ **The warning #34.02 left here is DISCHARGED, and this is the note
    // that says so rather than a note that repeats it.** That warning was:
    // create mode is safe only because `new-property-shell.tsx` renders the
    // form with no `initialValues`, and `tarlaSola` is validated against
    // `lookup_tarla` NOWHERE — so the day somebody added a create-mode prefill,
    // the form would start minting import-origin rows for values a person
    // chose. Both halves are gone. `property.tarla_id` is a foreign key, so an
    // unlisted value is a 23503 rather than a new row, and the form sends
    // `tarlaId`, which `resolveTarlaForCreate` returns untouched. A prefill
    // today prefills a row that already exists.

    return full;
  }
}

// ---------------------------------------------------------------------------
// Update — partial, replace-all semantics for corners + address
// ---------------------------------------------------------------------------

export async function updateProperty(
  id:    string,
  input: PropertyUpdate,
  updatedBy: string | null = null,
): Promise<PropertyFull | null> {
  return await db.transaction((tx) => updatePropertyIn(tx, id, input, updatedBy));
}

/**
 * The same update, inside a transaction the CALLER opened.   (Slice #26.07)
 *
 * Same split, and the same reason, as `createPropertyIn` above — but this half
 * was added by an adversarial round rather than by the original design, and the
 * bug it closes is worth stating.
 *
 * #26.07 gives an existing corner-less Property the corners from its folder's
 * coordinate file. The first version checked `cornerCount === 0` inside the
 * advisory-locked transaction and then called `updateProperty` AFTER it, with a
 * comment claiming the check made the write safe. It did not:
 * `pg_advisory_xact_lock` is released when the transaction ends, so the check
 * was under the lock and the write was not. Two runs against one corner-less
 * Property could both read zero, both commit, and both replace — last writer
 * wins, and the loser's run still claims `property_corner_source` for a
 * coordinate document whose corners are no longer stored. That is precisely the
 * lie #23.06 exists to prevent, rebuilt one slice later.
 *
 * With this, the check and the write are the same transaction and the same lock.
 */
export async function updatePropertyIn(
  tx:    DbTransaction,
  id:    string,
  input: PropertyUpdate,
  updatedBy: string | null = null,
): Promise<PropertyFull | null> {
  const { address: addrInput, corners: cornerList, ...propFields } = input;

  {
    // Verify exists and not deleted.
    const existing = await tx
      .select()
      .from(property)
      .where(eq(property.id, id))
      .limit(1);
    if (existing.length === 0) return null;

    // Build property patch from only explicitly-provided fields.
    // Always include updatedBy so the audit trail is always current.
    const propPatch: Partial<typeof property.$inferInsert> = { updatedBy };
    if (propFields.propertyTypeId  !== undefined) propPatch.propertyTypeId  = propFields.propertyTypeId  ?? null;
    if (propFields.nickname        !== undefined) propPatch.nickname        = propFields.nickname        ?? null;
    if (propFields.tarlaId         !== undefined) propPatch.tarlaId         = propFields.tarlaId         ?? null;
    if (propFields.parcela         !== undefined) propPatch.parcela         = propFields.parcela         ?? null;
    if (propFields.cadastralNumber !== undefined) propPatch.cadastralNumber = propFields.cadastralNumber ?? null;
    if (propFields.carteFunciara   !== undefined) propPatch.carteFunciara   = propFields.carteFunciara   ?? null;
    if (propFields.useCategoryId   !== undefined) propPatch.useCategoryId   = propFields.useCategoryId   ?? null;
    if (propFields.surfaceAreaMp   !== undefined) {
      propPatch.surfaceAreaMp = propFields.surfaceAreaMp != null
        ? String(propFields.surfaceAreaMp)
        : null;
    }
    if (propFields.notes           !== undefined) propPatch.notes           = propFields.notes           ?? null;

    await tx.update(property).set(propPatch).where(eq(property.id, id));

    // Address: undefined = untouched; null = delete; object = replace.
    if (addrInput !== undefined) {
      await tx
        .delete(propertyAddress)
        .where(eq(propertyAddress.propertyId, id));
      if (addrInput !== null) {
        await tx.insert(propertyAddress).values({
          propertyId: id,
          streetLine: addrInput.streetLine ?? null,
          postalCode: addrInput.postalCode ?? null,
          locality:   addrInput.locality   ?? null,
          county:     addrInput.county     ?? null,
          country:    addrInput.country,
          notes:      addrInput.notes      ?? null,
          streetViewStreetLine: addrInput.streetViewStreetLine ?? null,
        });
      }
    }

    // Corners: undefined = untouched; [] = delete all; non-empty = replace all.
    if (cornerList !== undefined) {
      await tx
        .delete(propertyCorner)
        .where(eq(propertyCorner.propertyId, id));
      if (cornerList.length > 0) {
        await tx.insert(propertyCorner).values(
          cornerList.map((c, i) => ({
            propertyId: id,
            sequenceNo: i + 1,
            lat:        c.lat,
            lon:        c.lon,
            originalIndex: c.originalIndex ?? null,
          })),
        );
      }
    }

    // Re-fetch full record.
    const [refreshedProp] = await tx
      .select()
      .from(property)
      .where(eq(property.id, id))
      .limit(1);

    const [refreshedAddr] = await tx
      .select()
      .from(propertyAddress)
      .where(eq(propertyAddress.propertyId, id))
      .limit(1);

    const refreshedCorners = await tx
      .select()
      .from(propertyCorner)
      .where(eq(propertyCorner.propertyId, id))
      .orderBy(propertyCorner.sequenceNo);

    // Slice #18.09 / #32.14: always recompute both derived values from the
    // now-settled corner set (covers added/removed/moved corners; a no-op when
    // corners were untouched). Persist them and reflect them on the in-memory
    // row used below.
    //
    // This is the second choke point, and it is what CLEARS the marker: a user
    // who straightens the order and saves arrives here, the ring is simple, and
    // the flag goes false by the same path that set it. There is no separate
    // "unmark" anywhere, deliberately — one measurement, one writer.
    const geometry = computeCornerGeometry(refreshedCorners);
    if (
      (refreshedProp.calculatedAreaMp ?? null) !== geometry.calculatedAreaMp ||
      refreshedProp.cornerOrderSelfIntersects !== geometry.selfIntersects
    ) {
      await tx
        .update(property)
        .set({
          calculatedAreaMp:          geometry.calculatedAreaMp,
          cornerOrderSelfIntersects: geometry.selfIntersects,
        })
        .where(eq(property.id, id));
      refreshedProp.calculatedAreaMp          = geometry.calculatedAreaMp;
      refreshedProp.cornerOrderSelfIntersects = geometry.selfIntersects;
    }

    const full: PropertyFull = {
      property: refreshedProp,
      address:  refreshedAddr ?? null,
      corners:  refreshedCorners,
    };

    // Slice #18.02: append a new version snapshot — but skip if this save
    // produced no actual change vs the latest stored version (no-op backstop).
    // Slice #29.14 moved the comparison itself into
    // `recordPropertyVersionsIfChanged` so the bulk re-point makes the same one
    // rather than a second copy of it. The snapshot is handed over rather than
    // rebuilt, because this path has already paid for the re-fetch above.
    await recordPropertyVersionsIfChanged(
      tx,
      [id],
      updatedBy,
      new Map([[id, snapshotFromFull(full)]]),
    );

    return full;
  }
}

// ---------------------------------------------------------------------------
// Property <-> Person associations  (Slice #5.1)
// ---------------------------------------------------------------------------

export type PropertyPersonItem = {
  id:           string;  // person.id
  code:         string;
  type:         "NATURAL" | "JUDICIAL";
  displayName:  string;
  roleName:     string | null;
  associatedAt: Date;
};

/** List all non-deleted persons currently associated with a property. */
export async function listPropertyPersons(
  propertyId: string,
): Promise<PropertyPersonItem[]> {
  const rows = await db
    .select({
      id:           person.id,
      code:         person.code,
      type:         person.type,
      displayName:  person.displayName,
      roleName:     lookupPersonRole.name,
      associatedAt: propertyPerson.createdAt,
    })
    .from(propertyPerson)
    .innerJoin(person, eq(person.id, propertyPerson.personId))
    .leftJoin(lookupPersonRole, eq(lookupPersonRole.id, propertyPerson.personRoleId))
    .where(
      eq(propertyPerson.propertyId, propertyId),
    )
    .orderBy(person.code);

  return rows as PropertyPersonItem[];
}

/**
 * Associate one or more persons with a property, with an optional shared role.
 * Duplicate associations are silently ignored (ON CONFLICT DO NOTHING).
 */
export async function associatePersonsToProperty(
  propertyId:   string,
  personIds:    string[],
  personRoleId: string | null = null,
): Promise<void> {
  if (personIds.length === 0) return;
  await db
    .insert(propertyPerson)
    .values(
      personIds.map((pid) => ({
        propertyId,
        personId:     pid,
        personRoleId: personRoleId ?? undefined,
      })),
    )
    .onConflictDoNothing();
}

/** Remove a single person association. Returns false if it didn't exist. */
export async function dissociatePersonFromProperty(
  propertyId: string,
  personId:   string,
): Promise<boolean> {
  const result = await db
    .delete(propertyPerson)
    .where(
      and(
        eq(propertyPerson.propertyId, propertyId),
        eq(propertyPerson.personId,   personId),
      ),
    )
    .returning({ id: propertyPerson.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
//
// Slice #29.04: a real delete, and both the single and the batch route go
// through `deleteProperties` — the batch route used to write `deleted_at`
// inline and so never released the corner-source claim that the single delete
// released explicitly. That whole class of drift is gone with the second
// delete path.
//
// The explicit `releaseCornerSourceForProperty` call this function used to
// make is gone too, and NOT because it stopped mattering. It was there only
// because a soft delete left the row in place, so `property_corner_source`'s
// ON DELETE CASCADE never fired and the link outlived its Property, locking
// its source document forever. A real delete makes the cascade fire, which
// does the same job in the database where it cannot be forgotten.

export async function deleteProperties(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  return await db.transaction(async (tx) => {
    const rows = await tx
      .delete(property)
      .where(inArray(property.id, ids))
      .returning({ principalObjectId: property.principalObjectId });

    await deletePrincipalObjects(tx, rows.map((r) => r.principalObjectId));
    return rows.length;
  });
}

/** Single-property delete. Returns false when the id matched nothing (→ 404). */
export async function deleteProperty(id: string): Promise<boolean> {
  return (await deleteProperties([id])) > 0;
}

// ---------------------------------------------------------------------------
// Property <-> Document  (Slice #5.2)
// ---------------------------------------------------------------------------

import { document, lookupDocumentType, lookupPropertyPropertyRole, propertyDocument, propertyProperty } from "@/db/schema";

export type PropertyDocumentItem = {
  id:             string;
  code:           string;
  documentTypeId: string;
  typeName:       string | null;
  title:          string | null;
  associatedAt:   Date;
};

export async function listPropertyDocuments(propertyId: string): Promise<PropertyDocumentItem[]> {
  const rows = await db
    .select({
      id:             document.id,
      code:           document.code,
      documentTypeId: document.documentTypeId,
      typeName:       lookupDocumentType.name,
      title:          document.title,
      associatedAt:   propertyDocument.createdAt,
    })
    .from(propertyDocument)
    .innerJoin(document, eq(propertyDocument.documentId, document.id))
    .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .where(eq(propertyDocument.propertyId, propertyId))
    .orderBy(document.code);

  return rows as PropertyDocumentItem[];
}

export async function associateDocumentsToProperty(propertyId: string, documentIds: string[]): Promise<void> {
  await db.insert(propertyDocument)
    .values(documentIds.map((did) => ({ propertyId, documentId: did })))
    .onConflictDoNothing();
}

export async function dissociateDocumentFromProperty(propertyId: string, documentId: string): Promise<boolean> {
  const result = await db.delete(propertyDocument)
    .where(and(eq(propertyDocument.propertyId, propertyId), eq(propertyDocument.documentId, documentId)))
    .returning({ id: propertyDocument.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Property <-> Property  (self-ref, symmetric)
// ---------------------------------------------------------------------------

export type PropertyRefItem = {
  id:               string;
  code:             string;
  nickname:         string | null;
  label:            string;   // nickname ?? code
  associatedAt:     Date;
  relationshipRoleId:   string | null;
  relationshipRoleName: string | null;
};

export async function listPropertyReferences(propertyId: string): Promise<PropertyRefItem[]> {
  const rows = await db
    .select({
      propertyIdA:          propertyProperty.propertyIdA,
      propertyIdB:          propertyProperty.propertyIdB,
      associatedAt:         propertyProperty.createdAt,
      relationshipRoleId:   propertyProperty.relationshipRoleId,
      relationshipRoleName: lookupPropertyPropertyRole.name,
      id:                   property.id,
      code:                 property.code,
      nickname:             property.nickname,
    })
    .from(propertyProperty)
    .innerJoin(
      property,
      or(
          and(eq(propertyProperty.propertyIdA, propertyId), eq(property.id, propertyProperty.propertyIdB)),
          and(eq(propertyProperty.propertyIdB, propertyId), eq(property.id, propertyProperty.propertyIdA)),
        ),
    )
    .leftJoin(
      lookupPropertyPropertyRole,
      eq(propertyProperty.relationshipRoleId, lookupPropertyPropertyRole.id),
    )
    .where(or(eq(propertyProperty.propertyIdA, propertyId), eq(propertyProperty.propertyIdB, propertyId)))
    .orderBy(property.code);

  return rows.map((r) => ({
    id:                   r.id,
    code:                 r.code,
    nickname:             r.nickname,
    label:                r.nickname ?? r.code,
    associatedAt:         r.associatedAt,
    relationshipRoleId:   r.relationshipRoleId ?? null,
    relationshipRoleName: r.relationshipRoleName ?? null,
  }));
}

export async function associatePropertiesToProperty(
  propertyId:         string,
  otherIds:           string[],
  relationshipRoleId: string | null = null,
): Promise<void> {
  const values = otherIds
    .filter((id) => id !== propertyId)
    .map((otherId) => {
      const [a, b] = [propertyId, otherId].sort();
      return {
        propertyIdA:         a,
        propertyIdB:         b,
        relationshipRoleId:  relationshipRoleId ?? undefined,
      };
    });
  if (values.length === 0) return;
  await db.insert(propertyProperty).values(values).onConflictDoNothing();
}

export async function dissociatePropertyFromProperty(propertyId: string, otherId: string): Promise<boolean> {
  const [a, b] = [propertyId, otherId].sort();
  const result = await db.delete(propertyProperty)
    .where(and(eq(propertyProperty.propertyIdA, a), eq(propertyProperty.propertyIdB, b)))
    .returning({ id: propertyProperty.id });
  return result.length > 0;
}
