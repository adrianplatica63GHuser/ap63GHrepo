/**
 * DB query helpers for the Person API.
 *
 * Manual joins/queries (no Drizzle "with" relations) — keeps the schema
 * file small and the data flow explicit.
 *
 * Soft delete: the API path always sets `person.deleted_at`. The list view
 * filters out deleted rows; getPersonById also returns null for deleted.
 *
 * Address PATCH semantics (merge by kind): when `addresses` is included in
 * the update payload, we delete all existing addresses for the person and
 * insert the new set. Omitting `addresses` from the payload leaves them
 * untouched.
 */

import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { address, naturalPerson, person, principalObject } from "@/db/schema";
import type {
  ListQuery,
  NaturalPersonCreate,
  NaturalPersonUpdate,
} from "./validation";

// ---------------------------------------------------------------------------
// Display name — single source of truth for the cached `person.display_name`.
// ---------------------------------------------------------------------------

export function computeDisplayName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type PersonListItem = {
  id: string;
  code: string;
  type: "NATURAL" | "JUDICIAL";
  displayName: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listPersons(opts: ListQuery): Promise<{
  items: PersonListItem[];
  total: number;
}> {
  const q = opts.q?.trim();
  const searchPattern = q ? `%${q}%` : null;

  const where = and(
    // The /natural-persons list page must not surface judicial rows. Without
    // this filter, judicial persons (added in Slice #4.6) would appear at the
    // top of the natural list with empty email/phone columns.
    eq(person.type, "NATURAL"),
    isNull(person.deletedAt),
    searchPattern
      ? or(
          ilike(person.displayName, searchPattern),
          ilike(naturalPerson.personalEmail1, searchPattern),
          ilike(naturalPerson.personalEmail2, searchPattern),
          ilike(naturalPerson.workEmail, searchPattern),
          ilike(naturalPerson.personalPhone1, searchPattern),
          ilike(naturalPerson.personalPhone2, searchPattern),
          ilike(naturalPerson.workPhone, searchPattern),
        )
      : undefined,
  );

  const [items, totals] = await Promise.all([
    db
      .select({
        id: person.id,
        code: person.code,
        type: person.type,
        displayName: person.displayName,
        email: sql<string | null>`coalesce(${naturalPerson.personalEmail1}, ${naturalPerson.personalEmail2}, ${naturalPerson.workEmail})`,
        phone: sql<string | null>`coalesce(${naturalPerson.personalPhone1}, ${naturalPerson.personalPhone2}, ${naturalPerson.workPhone})`,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
      })
      .from(person)
      .leftJoin(naturalPerson, eq(naturalPerson.personId, person.id))
      .where(where)
      // Slice #16.UX.01: most-recently modified/created first. updatedAt is
      // always >= createdAt in this schema (it defaults to now() on insert
      // too), but GREATEST() is used to be explicit and future-proof.
      .orderBy(sql`greatest(${person.updatedAt}, ${person.createdAt}) desc`)
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ total: count() })
      .from(person)
      .leftJoin(naturalPerson, eq(naturalPerson.personId, person.id))
      .where(where),
  ]);

  return { items, total: totals[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Get by id (full record: person + subtype + addresses)
// ---------------------------------------------------------------------------

export type PersonFull = {
  person: typeof person.$inferSelect;
  natural: typeof naturalPerson.$inferSelect | null;
  addresses: (typeof address.$inferSelect)[];
};

export async function getPersonById(id: string): Promise<PersonFull | null> {
  const personRows = await db
    .select()
    .from(person)
    .where(and(eq(person.id, id), isNull(person.deletedAt)))
    .limit(1);

  if (personRows.length === 0) return null;
  const personRow = personRows[0];

  const [naturalRows, addressRows] = await Promise.all([
    personRow.type === "NATURAL"
      ? db
          .select()
          .from(naturalPerson)
          .where(eq(naturalPerson.personId, id))
          .limit(1)
      : Promise.resolve([]),
    db
      .select()
      .from(address)
      .where(eq(address.personId, id))
      .orderBy(address.kind),
  ]);

  return {
    person: personRow,
    natural: naturalRows[0] ?? null,
    addresses: addressRows,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createNaturalPerson(
  input: NaturalPersonCreate,
): Promise<PersonFull> {
  const { addresses: addressList, notes, ...natFields } = input;
  const displayName =
    computeDisplayName(natFields.firstName, natFields.lastName) ||
    // The Zod refinement guarantees at least one of firstName/lastName,
    // so this fallback should be unreachable. Belt-and-braces.
    "(unnamed)";

  return await db.transaction(async (tx) => {
    // Allocate a code from the shared sequence via the principal_object row.
    const [poRow] = await tx
      .insert(principalObject)
      .values({
        objectType: "PERSON",
        code: sql`'PERS' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
      })
      .returning();

    const [pRow] = await tx
      .insert(person)
      .values({
        principalObjectId: poRow.id,
        code: poRow.code,
        type: "NATURAL",
        displayName,
        notes: notes ?? null,
      })
      .returning();

    const [nRow] = await tx
      .insert(naturalPerson)
      .values({
        personId: pRow.id,
        firstName: natFields.firstName ?? null,
        lastName: natFields.lastName ?? null,
        nickname: natFields.nickname ?? null,
        cnp: natFields.cnp ?? null,
        idDocumentType: natFields.idDocumentType ?? null,
        idDocumentNumber: natFields.idDocumentNumber ?? null,
        gender: natFields.gender ?? null,
        dateOfBirth: natFields.dateOfBirth ?? null,
        personalPhone1: natFields.personalPhone1 ?? null,
        personalPhone2: natFields.personalPhone2 ?? null,
        workPhone: natFields.workPhone ?? null,
        personalEmail1: natFields.personalEmail1 ?? null,
        personalEmail2: natFields.personalEmail2 ?? null,
        workEmail: natFields.workEmail ?? null,
        placeOfBirth: natFields.placeOfBirth ?? null,
        idIssuingAuthority: natFields.idIssuingAuthority ?? null,
        idValidFrom: natFields.idValidFrom ?? null,
        idValidUntil: natFields.idValidUntil ?? null,
        idCardNumber: natFields.idCardNumber ?? null,
        idMrzRaw: natFields.idMrzRaw ?? null,
        citizenshipId: natFields.citizenshipId ?? null,
      })
      .returning();

    let addressRows: (typeof address.$inferSelect)[] = [];
    if (addressList.length > 0) {
      addressRows = await tx
        .insert(address)
        .values(
          addressList.map((a) => ({
            personId: pRow.id,
            kind: a.kind,
            streetLine: a.streetLine ?? null,
            postalCode: a.postalCode ?? null,
            locality: a.locality ?? null,
            county: a.county ?? null,
            country: a.country,
            notes: a.notes ?? null,
          })),
        )
        .returning();
    }

    return { person: pRow, natural: nRow, addresses: addressRows };
  });
}

// ---------------------------------------------------------------------------
// Update — partial, with merge-by-kind addresses semantics
// ---------------------------------------------------------------------------

export async function updateNaturalPerson(
  id: string,
  input: NaturalPersonUpdate,
): Promise<PersonFull | null> {
  const { addresses: addressList, notes, ...natUpdate } = input;

  return await db.transaction(async (tx) => {
    // Verify person exists and is not deleted.
    const personRows = await tx
      .select()
      .from(person)
      .where(and(eq(person.id, id), isNull(person.deletedAt)))
      .limit(1);
    if (personRows.length === 0) return null;

    // Update natural_person fields if any were provided.
    const hasNatUpdate = Object.values(natUpdate).some((v) => v !== undefined);
    if (hasNatUpdate) {
      await tx
        .update(naturalPerson)
        .set(natUpdate)
        .where(eq(naturalPerson.personId, id));
    }

    // If first/last name might have changed, recompute display_name.
    // (Cheaper to always recompute when we have the satellite update than
    // to inspect each field.)
    const needsDisplayNameRefresh =
      natUpdate.firstName !== undefined || natUpdate.lastName !== undefined;

    if (needsDisplayNameRefresh || notes !== undefined) {
      const personPatch: Partial<typeof person.$inferInsert> = {};
      if (notes !== undefined) personPatch.notes = notes ?? null;
      if (needsDisplayNameRefresh) {
        const fresh = await tx
          .select({
            firstName: naturalPerson.firstName,
            lastName: naturalPerson.lastName,
          })
          .from(naturalPerson)
          .where(eq(naturalPerson.personId, id))
          .limit(1);
        const newDisplay =
          computeDisplayName(fresh[0]?.firstName, fresh[0]?.lastName) ||
          "(unnamed)";
        personPatch.displayName = newDisplay;
      }
      if (Object.keys(personPatch).length > 0) {
        await tx.update(person).set(personPatch).where(eq(person.id, id));
      }
    }

    // Address merge-by-kind: omitted = leave alone; provided = delete all + reinsert.
    if (addressList !== undefined) {
      await tx.delete(address).where(eq(address.personId, id));
      if (addressList.length > 0) {
        await tx.insert(address).values(
          addressList.map((a) => ({
            personId: id,
            kind: a.kind,
            streetLine: a.streetLine ?? null,
            postalCode: a.postalCode ?? null,
            locality: a.locality ?? null,
            county: a.county ?? null,
            country: a.country,
            notes: a.notes ?? null,
          })),
        );
      }
    }

    // Re-fetch full record for the response.
    const [refreshedPerson] = await tx
      .select()
      .from(person)
      .where(eq(person.id, id))
      .limit(1);
    const [refreshedNatural] = await tx
      .select()
      .from(naturalPerson)
      .where(eq(naturalPerson.personId, id))
      .limit(1);
    const refreshedAddresses = await tx
      .select()
      .from(address)
      .where(eq(address.personId, id))
      .orderBy(address.kind);

    return {
      person: refreshedPerson,
      natural: refreshedNatural ?? null,
      addresses: refreshedAddresses,
    };
  });
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export async function softDeletePerson(id: string): Promise<boolean> {
  const result = await db
    .update(person)
    .set({ deletedAt: new Date() })
    .where(and(eq(person.id, id), isNull(person.deletedAt)))
    .returning({ id: person.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Search ALL persons (Natural + Judicial) — used by the associate-person flow
// ---------------------------------------------------------------------------
//
// Unlike `listPersons` (which hard-filters to NATURAL for the persons list
// page), this function returns both person types so the user can associate
// any kind of person with a property.

export type PersonSearchItem = {
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
};

export async function searchPersonsAll(opts: {
  name?:   string;
  code?:   string;
  limit:   number;
  offset:  number;
  /** When provided, restrict results to a single person type. */
  type?:   "NATURAL" | "JUDICIAL";
}): Promise<{ items: PersonSearchItem[]; total: number }> {
  const namePat = opts.name?.trim() ? `%${opts.name.trim()}%` : null;
  const codePat = opts.code?.trim() ? `%${opts.code.trim()}%` : null;

  const where = and(
    isNull(person.deletedAt),
    opts.type ? eq(person.type, opts.type) : undefined,
    namePat ? ilike(person.displayName, namePat) : undefined,
    codePat ? ilike(person.code,        codePat) : undefined,
  );

  const [items, totals] = await Promise.all([
    db
      .select({
        id:          person.id,
        code:        person.code,
        type:        person.type,
        displayName: person.displayName,
      })
      .from(person)
      .where(where)
      .orderBy(person.code)
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ total: count() })
      .from(person)
      .where(where),
  ]);

  return { items: items as PersonSearchItem[], total: totals[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Person <-> Property  (uses existing property_person junction — reverse side)
// ---------------------------------------------------------------------------

import {
  lookupPersonRole,
  lookupDocumentType,
  property,
  propertyPerson,
  personDocument,
  personPerson,
  document,
} from "@/db/schema";

export type PersonPropertyItem = {
  id:           string;
  code:         string;
  label:        string;   // nickname ?? code
  roleName:     string | null;
  associatedAt: Date;
};

export async function listPersonProperties(personId: string): Promise<PersonPropertyItem[]> {
  const rows = await db
    .select({
      id:           property.id,
      code:         property.code,
      nickname:     property.nickname,
      roleName:     lookupPersonRole.name,
      associatedAt: propertyPerson.createdAt,
    })
    .from(propertyPerson)
    .innerJoin(property, and(eq(propertyPerson.propertyId, property.id), isNull(property.deletedAt)))
    .leftJoin(lookupPersonRole, eq(lookupPersonRole.id, propertyPerson.personRoleId))
    .where(eq(propertyPerson.personId, personId))
    .orderBy(property.code);

  return rows.map((r) => ({
    id:           r.id,
    code:         r.code,
    label:        r.nickname ?? r.code,
    roleName:     r.roleName ?? null,
    associatedAt: r.associatedAt,
  }));
}

export async function associatePropertiesToPerson(
  personId:     string,
  propertyIds:  string[],
  personRoleId: string | null = null,
): Promise<void> {
  await db.insert(propertyPerson)
    .values(propertyIds.map((pid) => ({
      propertyId:   pid,
      personId,
      personRoleId: personRoleId ?? undefined,
    })))
    .onConflictDoNothing();
}

export async function dissociatePropertyFromPerson(personId: string, propertyId: string): Promise<boolean> {
  const result = await db.delete(propertyPerson)
    .where(and(eq(propertyPerson.personId, personId), eq(propertyPerson.propertyId, propertyId)))
    .returning({ id: propertyPerson.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Person <-> Document
// ---------------------------------------------------------------------------

export type PersonDocumentItem = {
  id:             string;
  code:           string;
  documentTypeId: string;
  typeName:       string | null;
  title:          string | null;
  roleName:       string | null;
  associatedAt:   Date;
};

export async function listPersonDocuments(personId: string): Promise<PersonDocumentItem[]> {
  const rows = await db
    .select({
      id:             document.id,
      code:           document.code,
      documentTypeId: document.documentTypeId,
      typeName:       lookupDocumentType.name,
      title:          document.title,
      roleName:       lookupPersonRole.name,
      associatedAt:   personDocument.createdAt,
    })
    .from(personDocument)
    .innerJoin(document, and(eq(personDocument.documentId, document.id), isNull(document.deletedAt)))
    .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .leftJoin(lookupPersonRole, eq(personDocument.personRoleId, lookupPersonRole.id))
    .where(eq(personDocument.personId, personId))
    .orderBy(document.code);

  return rows as PersonDocumentItem[];
}

/**
 * The person's linked ID card Document (lookup_document_type.key =
 * CARTE_IDENTITATE), if one exists. Used to render the read-only "ID link"
 * row on the Details tab. A person can in principle have more than one such
 * Document linked; this returns the most recently associated one.
 */
export async function getPersonIdCardLink(
  personId: string,
): Promise<{ id: string; code: string } | null> {
  const rows = await db
    .select({ id: document.id, code: document.code })
    .from(personDocument)
    .innerJoin(document, and(eq(personDocument.documentId, document.id), isNull(document.deletedAt)))
    .innerJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .where(and(eq(personDocument.personId, personId), eq(lookupDocumentType.key, "CARTE_IDENTITATE")))
    .orderBy(desc(personDocument.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function associateDocumentsToPerson(
  personId:    string,
  documentIds: string[],
  personRoleId: string | null = null,
): Promise<void> {
  await db.insert(personDocument)
    .values(documentIds.map((did) => ({ personId, documentId: did, personRoleId })))
    .onConflictDoNothing();
}

export async function dissociateDocumentFromPerson(personId: string, documentId: string): Promise<boolean> {
  const result = await db.delete(personDocument)
    .where(and(eq(personDocument.personId, personId), eq(personDocument.documentId, documentId)))
    .returning({ id: personDocument.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Person <-> Person  (self-ref, symmetric)
// ---------------------------------------------------------------------------

export type PersonRefItem = {
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
  associatedAt: Date;
};

export async function listPersonReferences(personId: string): Promise<PersonRefItem[]> {
  // Query both sides of the symmetric pair.
  const rows = await db
    .select({
      personIdA:    personPerson.personIdA,
      personIdB:    personPerson.personIdB,
      associatedAt: personPerson.createdAt,
      id:           person.id,
      code:         person.code,
      type:         person.type,
      displayName:  person.displayName,
    })
    .from(personPerson)
    .innerJoin(
      person,
      and(
        or(
          and(eq(personPerson.personIdA, personId), eq(person.id, personPerson.personIdB)),
          and(eq(personPerson.personIdB, personId), eq(person.id, personPerson.personIdA)),
        ),
        isNull(person.deletedAt),
      ),
    )
    .where(or(eq(personPerson.personIdA, personId), eq(personPerson.personIdB, personId)))
    .orderBy(person.displayName);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    type: r.type as "NATURAL" | "JUDICIAL",
    displayName: r.displayName,
    associatedAt: r.associatedAt,
  }));
}

export async function associatePersonsToPerson(personId: string, otherIds: string[]): Promise<void> {
  const values = otherIds
    .filter((id) => id !== personId)
    .map((otherId) => {
      const [a, b] = [personId, otherId].sort();
      return { personIdA: a, personIdB: b };
    });
  if (values.length === 0) return;
  await db.insert(personPerson).values(values).onConflictDoNothing();
}

export async function dissociatePersonFromPerson(personId: string, otherId: string): Promise<boolean> {
  const [a, b] = [personId, otherId].sort();
  const result = await db.delete(personPerson)
    .where(and(eq(personPerson.personIdA, a), eq(personPerson.personIdB, b)))
    .returning({ id: personPerson.id });
  return result.length > 0;
}
