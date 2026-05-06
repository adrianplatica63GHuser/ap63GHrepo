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

import { and, count, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { person, property, propertyAddress, propertyCorner, propertyPerson } from "@/db/schema";
import type {
  PropertyCreate,
  PropertyListQuery,
  PropertyUpdate,
} from "./validation";

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
  useCategory:      string | null;
  surfaceAreaMp:    string | null;
  locality:         string | null;
  county:           string | null;
};

export type PropertyFull = {
  property: typeof property.$inferSelect;
  address:  typeof propertyAddress.$inferSelect | null;
  corners:  (typeof propertyCorner.$inferSelect)[];
};

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
        useCategory:     property.useCategory,
        surfaceAreaMp:   property.surfaceAreaMp,
        locality:        propertyAddress.locality,
        county:          propertyAddress.county,
      })
      .from(property)
      .leftJoin(
        propertyAddress,
        eq(propertyAddress.propertyId, property.id),
      )
      .where(where)
      .orderBy(property.code)
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
    const [propRow] = await tx
      .insert(property)
      .values({
        type:            "LAND",
        nickname:        propFields.nickname        ?? null,
        tarlaSola:       propFields.tarlaSola       ?? null,
        parcela:         propFields.parcela         ?? null,
        cadastralNumber: propFields.cadastralNumber ?? null,
        carteFunciara:   propFields.carteFunciara   ?? null,
        useCategory:     propFields.useCategory     ?? null,
        surfaceAreaMp:   propFields.surfaceAreaMp != null
                           ? String(propFields.surfaceAreaMp)
                           : null,
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
          })),
        )
        .returning();
    }

    return { property: propRow, address: addrRow, corners: cornerRows };
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
    if (propFields.nickname        !== undefined) propPatch.nickname        = propFields.nickname        ?? null;
    if (propFields.tarlaSola       !== undefined) propPatch.tarlaSola       = propFields.tarlaSola       ?? null;
    if (propFields.parcela         !== undefined) propPatch.parcela         = propFields.parcela         ?? null;
    if (propFields.cadastralNumber !== undefined) propPatch.cadastralNumber = propFields.cadastralNumber ?? null;
    if (propFields.carteFunciara   !== undefined) propPatch.carteFunciara   = propFields.carteFunciara   ?? null;
    if (propFields.useCategory     !== undefined) propPatch.useCategory     = propFields.useCategory     ?? null;
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

    return {
      property: refreshedProp,
      address:  refreshedAddr ?? null,
      corners:  refreshedCorners,
    };
  });
}

// ---------------------------------------------------------------------------
// Property <-> Person associations  (Slice #5.1)
// ---------------------------------------------------------------------------

export type PropertyPersonItem = {
  id:          string;  // person.id
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
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
      associatedAt: propertyPerson.createdAt,
    })
    .from(propertyPerson)
    .innerJoin(person, eq(person.id, propertyPerson.personId))
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
 * Associate one or more persons with a property.
 * Duplicate associations are silently ignored (ON CONFLICT DO NOTHING).
 */
export async function associatePersonsToProperty(
  propertyId: string,
  personIds:  string[],
): Promise<void> {
  if (personIds.length === 0) return;
  await db
    .insert(propertyPerson)
    .values(personIds.map((pid) => ({ propertyId, personId: pid })))
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
// Property <-> Paperwork  (Slice #5.2)
// ---------------------------------------------------------------------------

import { paperwork, propertyPaperwork, propertyProperty } from "@/db/schema";

export type PropertyPaperworkItem = {
  id:           string;
  code:         string;
  type:         string;
  title:        string | null;
  associatedAt: Date;
};

export async function listPropertyPaperwork(propertyId: string): Promise<PropertyPaperworkItem[]> {
  const rows = await db
    .select({
      id:           paperwork.id,
      code:         paperwork.code,
      type:         paperwork.type,
      title:        paperwork.title,
      associatedAt: propertyPaperwork.createdAt,
    })
    .from(propertyPaperwork)
    .innerJoin(paperwork, and(eq(propertyPaperwork.paperworkId, paperwork.id), isNull(paperwork.deletedAt)))
    .where(eq(propertyPaperwork.propertyId, propertyId))
    .orderBy(paperwork.code);

  return rows as PropertyPaperworkItem[];
}

export async function associatePaperworkToProperty(propertyId: string, paperworkIds: string[]): Promise<void> {
  await db.insert(propertyPaperwork)
    .values(paperworkIds.map((pid) => ({ propertyId, paperworkId: pid })))
    .onConflictDoNothing();
}

export async function dissociatePaperworkFromProperty(propertyId: string, paperworkId: string): Promise<boolean> {
  const result = await db.delete(propertyPaperwork)
    .where(and(eq(propertyPaperwork.propertyId, propertyId), eq(propertyPaperwork.paperworkId, paperworkId)))
    .returning({ id: propertyPaperwork.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Property <-> Property  (self-ref, symmetric)
// ---------------------------------------------------------------------------

export type PropertyRefItem = {
  id:           string;
  code:         string;
  label:        string;  // nickname ?? code
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
    id: r.id, code: r.code, label: r.nickname ?? r.code, associatedAt: r.associatedAt,
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
