/**
 * DB query helpers for the Property API.
 *
 * Soft delete: list + getById filter out deleted rows.
 *
 * Corner / address update semantics (replace-all):
 *   When `corners` or `address` is included in the update payload the existing
 *   rows are deleted and the new ones re-inserted. Omitting either key leaves
 *   those rows untouched. Passing address: null deletes the address row.
 */

import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { lookupPersonRole, person, principalObject, property, propertyAddress, propertyCorner, propertyPerson, propertyVersion } from "@/db/schema";
import { wgs84ToStereo70 } from "@/lib/geo/transdatRO";
import { shoelaceAreaM2 } from "./area";
import type {
  PropertyCreate,
  PropertyListQuery,
  PropertySnapshot,
  PropertyUpdate,
} from "./validation";

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
  locality:         string | null;
  county:           string | null;
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

  const where = and(
    isNull(property.deletedAt),
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
        locality:        propertyAddress.locality,
        county:          propertyAddress.county,
        createdAt:       property.createdAt,
        updatedAt:       property.updatedAt,
      })
      .from(property)
      .leftJoin(
        propertyAddress,
        eq(propertyAddress.propertyId, property.id),
      )
      .where(where)
      // Slice #16.UX.01: most-recently modified/created first.
      .orderBy(sql`greatest(${property.updatedAt}, ${property.createdAt}) desc`)
      .limit(opts.limit)
      .offset(opts.offset),

    db
      .select({ total: count() })
      .from(property)
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
    .where(and(eq(property.id, id), isNull(property.deletedAt)))
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
// Create
// ---------------------------------------------------------------------------

export async function createProperty(
  input: PropertyCreate,
): Promise<PropertyFull> {
  const { address: addrInput, corners: cornerList, ...propFields } = input;

  return await db.transaction(async (tx) => {
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
    });

    return full;
  });
}

// ---------------------------------------------------------------------------
// Update — partial, replace-all semantics for corners + address
// ---------------------------------------------------------------------------

export async function updateProperty(
  id:    string,
  input: PropertyUpdate,
): Promise<PropertyFull | null> {
  const { address: addrInput, corners: cornerList, ...propFields } = input;

  return await db.transaction(async (tx) => {
    // Verify exists and not deleted.
    const existing = await tx
      .select()
      .from(property)
      .where(and(eq(property.id, id), isNull(property.deletedAt)))
      .limit(1);
    if (existing.length === 0) return null;

    // Build property patch from only explicitly-provided fields.
    const propPatch: Partial<typeof property.$inferInsert> = {};
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

    if (Object.keys(propPatch).length > 0) {
      await tx.update(property).set(propPatch).where(eq(property.id, id));
    }

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
      });
    }

    return full;
  });
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
      and(
        eq(propertyPerson.propertyId, propertyId),
        isNull(person.deletedAt),
      ),
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
// Soft delete
// ---------------------------------------------------------------------------

export async function softDeleteProperty(id: string): Promise<boolean> {
  const result = await db
    .update(property)
    .set({ deletedAt: new Date() })
    .where(and(eq(property.id, id), isNull(property.deletedAt)))
    .returning({ id: property.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Property <-> Document  (Slice #5.2)
// ---------------------------------------------------------------------------

import { document, lookupDocumentType, propertyDocument, propertyProperty } from "@/db/schema";

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
    .innerJoin(document, and(eq(propertyDocument.documentId, document.id), isNull(document.deletedAt)))
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
  id:           string;
  code:         string;
  nickname:     string | null;
  label:        string;   // nickname ?? code
  associatedAt: Date;
};

export async function listPropertyReferences(propertyId: string): Promise<PropertyRefItem[]> {
  const rows = await db
    .select({
      propertyIdA:  propertyProperty.propertyIdA,
      propertyIdB:  propertyProperty.propertyIdB,
      associatedAt: propertyProperty.createdAt,
      id:           property.id,
      code:         property.code,
      nickname:     property.nickname,
    })
    .from(propertyProperty)
    .innerJoin(
      property,
      and(
        or(
          and(eq(propertyProperty.propertyIdA, propertyId), eq(property.id, propertyProperty.propertyIdB)),
          and(eq(propertyProperty.propertyIdB, propertyId), eq(property.id, propertyProperty.propertyIdA)),
        ),
        isNull(property.deletedAt),
      ),
    )
    .where(or(eq(propertyProperty.propertyIdA, propertyId), eq(propertyProperty.propertyIdB, propertyId)))
    .orderBy(property.code);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    nickname: r.nickname,
    label: r.nickname ?? r.code,
    associatedAt: r.associatedAt,
  }));
}

export async function associatePropertiesToProperty(propertyId: string, otherIds: string[]): Promise<void> {
  const values = otherIds
    .filter((id) => id !== propertyId)
    .map((otherId) => {
      const [a, b] = [propertyId, otherId].sort();
      return { propertyIdA: a, propertyIdB: b };
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
