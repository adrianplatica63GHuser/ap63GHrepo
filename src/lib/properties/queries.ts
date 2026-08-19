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
import { cadastralKey } from "./cadastral-identity";
import type { CadastralMatch } from "./import-property-plan";
import { entityMetadata, groupMember, groups, lookupPersonRole, lookupTarla, person, principalObject, property, propertyAddress, propertyCorner, propertyPerson, propertyVersion } from "@/db/schema";
import { wgs84ToStereo70 } from "@/lib/geo/transdatRO";
import { shoelaceAreaM2 } from "./area";
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
// Calculated area (Slice #18.09)
// ---------------------------------------------------------------------------
//
// Project the WGS84 corners back to Stereo 70 (metres) and apply the shoelace
// formula to get the polygon's interior area in m². Returns a drizzle-numeric
// string (2 dp) or null when there are fewer than 3 corners. Never throws —
// any projection failure (e.g. a corner outside the Stereo 70 grid coverage)
// yields null so a save is never blocked by the area calc.

function computeCalculatedAreaMp(
  corners: { lat: number; lon: number }[],
): string | null {
  if (corners.length < 3) return null;
  try {
    const planar = corners.map((c) => wgs84ToStereo70(c.lat, c.lon));
    const area = shoelaceAreaM2(planar);
    return area == null ? null : area.toFixed(2);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type PropertyListItem = {
  id:               string;
  code:             string;
  nickname:         string | null;
  tarlaSola:        string | null;
  parcela:          string | null;
  cadastralNumber:  string | null;
  carteFunciara:    string | null;
  surfaceAreaMp:    string | null;
  calculatedAreaMp: string | null;
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
      tarlaSola:       p.tarlaSola       ?? null,
      parcela:         p.parcela         ?? null,
      cadastralNumber: p.cadastralNumber ?? null,
      carteFunciara:   p.carteFunciara   ?? null,
      useCategoryId:   p.useCategoryId   ?? null,
      // numeric column → drizzle returns string | null; keep as-is.
      surfaceAreaMp:   p.surfaceAreaMp   ?? null,
      // Slice #18.09: derived-but-persisted; included in the snapshot.
      calculatedAreaMp: p.calculatedAreaMp ?? null,
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

const SNAPSHOT_PROPERTY_KEYS: (keyof PropertySnapshot["property"])[] = [
  "propertyTypeId", "nickname", "tarlaSola", "parcela", "cadastralNumber",
  "carteFunciara", "useCategoryId", "surfaceAreaMp", "notes",
];
const SNAPSHOT_ADDRESS_KEYS: (keyof NonNullable<PropertySnapshot["address"]>)[] = [
  "streetLine", "postalCode", "locality", "county", "country", "notes",
  "streetViewStreetLine",
];

/**
 * Field-by-field equality of two snapshots. Used to skip writing a new version
 * when a save produced no actual change (the form's dirty-gate already mostly
 * prevents this; this is the backstop). Compared explicitly rather than via
 * JSON.stringify because Postgres jsonb does not preserve object key order.
 */
function snapshotsEqual(a: PropertySnapshot, b: PropertySnapshot): boolean {
  for (const k of SNAPSHOT_PROPERTY_KEYS) {
    if (a.property[k] !== b.property[k]) return false;
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
          ilike(property.tarlaSola,       pat),
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
        tarlaSola:       property.tarlaSola,
        parcela:         property.parcela,
        cadastralNumber: property.cadastralNumber,
        carteFunciara:   property.carteFunciara,
        surfaceAreaMp:   property.surfaceAreaMp,
        calculatedAreaMp: property.calculatedAreaMp,
        locality:        propertyAddress.locality,
        county:          propertyAddress.county,
        importance:      entityMetadata.importance,
        relevance:       entityMetadata.relevance,
        provenance:      entityMetadata.provenance,
        createdAt:       property.createdAt,
        updatedAt:       property.updatedAt,
      })
      .from(property)
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

  const candidates = await tx
    .select({
      id: property.id,
      code: property.code,
      nickname: property.nickname,
      principalObjectId: property.principalObjectId,
      tarlaSola: property.tarlaSola,
      parcela: property.parcela,
    })
    .from(property)
    .where(
      and(
        isNotNull(property.tarlaSola),
        isNotNull(property.parcela),
      ),
    )
    .orderBy(property.code);

  const hits = candidates.filter(
    (row) =>
      cadastralKey(row.tarlaSola ?? "") === wantedTarla &&
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

  {
    // Allocate a code from the shared sequence via the principal_object row.
    const [poRow] = await tx
      .insert(principalObject)
      .values({
        objectType: "PROPERTY",
        code: sql`'PROP' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
      })
      .returning();

    const [propRow] = await tx
      .insert(property)
      .values({
        principalObjectId: poRow.id,
        code:            poRow.code,
        propertyTypeId:  propFields.propertyTypeId  ?? null,
        nickname:        propFields.nickname        ?? null,
        tarlaSola:       propFields.tarlaSola       ?? null,
        parcela:         propFields.parcela         ?? null,
        cadastralNumber: propFields.cadastralNumber ?? null,
        carteFunciara:   propFields.carteFunciara   ?? null,
        useCategoryId:   propFields.useCategoryId   ?? null,
        surfaceAreaMp:   propFields.surfaceAreaMp != null
                           ? String(propFields.surfaceAreaMp)
                           : null,
        // Slice #18.09: computed from the corners supplied at creation.
        calculatedAreaMp: computeCalculatedAreaMp(cornerList),
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
    if (propFields.tarlaSola) {
      const existing = await tx
        .select({ id: lookupTarla.id })
        .from(lookupTarla)
        .where(eq(lookupTarla.indicativ, propFields.tarlaSola))
        .limit(1);
      if (existing.length === 0) {
        await tx.insert(lookupTarla).values({ indicativ: propFields.tarlaSola });
      }
    }

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
    if (propFields.tarlaSola       !== undefined) propPatch.tarlaSola       = propFields.tarlaSola       ?? null;
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

    // Slice #18.09: always recompute the calculated area from the now-settled
    // corner set (covers added/removed/moved corners; a no-op when corners were
    // untouched). Persist it and reflect it on the in-memory row used below.
    const newCalculatedArea = computeCalculatedAreaMp(refreshedCorners);
    if ((refreshedProp.calculatedAreaMp ?? null) !== newCalculatedArea) {
      await tx
        .update(property)
        .set({ calculatedAreaMp: newCalculatedArea })
        .where(eq(property.id, id));
      refreshedProp.calculatedAreaMp = newCalculatedArea;
    }

    const full: PropertyFull = {
      property: refreshedProp,
      address:  refreshedAddr ?? null,
      corners:  refreshedCorners,
    };

    // Slice #18.02: append a new version snapshot — but skip if this save
    // produced no actual change vs the latest stored version (no-op backstop).
    const newSnapshot = snapshotFromFull(full);
    const [latestVer] = await tx
      .select({
        versionNumber: propertyVersion.versionNumber,
        snapshot:      propertyVersion.snapshot,
      })
      .from(propertyVersion)
      .where(eq(propertyVersion.propertyId, id))
      .orderBy(desc(propertyVersion.versionNumber))
      .limit(1);

    const latestSnapshot = latestVer
      ? (latestVer.snapshot as PropertySnapshot)
      : null;

    if (!latestSnapshot || !snapshotsEqual(latestSnapshot, newSnapshot)) {
      await tx.insert(propertyVersion).values({
        propertyId:    id,
        versionNumber: (latestVer?.versionNumber ?? -1) + 1,
        snapshot:      newSnapshot,
        updatedBy,
      });
    }

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
