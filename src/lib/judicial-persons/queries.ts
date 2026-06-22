/**
 * DB query helpers for the Judicial Person API.
 *
 * Mirrors the natural-person queries module. All judicial-person operations
 * touch the `judicial_person` satellite plus the parent `person` row and
 * the shared `address` table.
 *
 * Soft delete reuses `softDeletePerson` from the natural-person module — it
 * is type-agnostic (just sets `person.deleted_at`).
 *
 * Address PATCH semantics (merge by kind): when `addresses` is included in
 * the update payload, we delete all existing addresses for the person and
 * insert the new set. Omitting `addresses` from the payload leaves them
 * untouched.
 *
 * contactPerson1Id / contactPerson2Id: nullable FK → person.id (NATURAL).
 * getJudicialPersonById enriches the result with the linked persons'
 * displayNames so the UI can render them without a second fetch.
 */

import { alias } from "drizzle-orm/pg-core";
import { and, count, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  address,
  judicialPerson,
  lookupJudicialPersonType,
  person,
  principalObject,
} from "@/db/schema";
import type {
  JudicialListQuery,
  JudicialPersonCreate,
  JudicialPersonUpdate,
} from "./validation";

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type JudicialPersonListItem = {
  id: string;
  code: string;
  displayName: string;
  nickname: string | null;
  cuiNumber: string | null;
};

export async function listJudicialPersons(opts: JudicialListQuery): Promise<{
  items: JudicialPersonListItem[];
  total: number;
}> {
  const q = opts.q?.trim();
  const searchPattern = q ? `%${q}%` : null;

  // Search clauses match the spec for the judicial detail page:
  // name, nickname, ID (= person.code).
  const where = and(
    eq(person.type, "JUDICIAL"),
    isNull(person.deletedAt),
    searchPattern
      ? or(
          ilike(person.displayName, searchPattern),
          ilike(judicialPerson.nickname, searchPattern),
          ilike(person.code, searchPattern),
        )
      : undefined,
  );

  const [items, totals] = await Promise.all([
    db
      .select({
        id: person.id,
        code: person.code,
        displayName: person.displayName,
        nickname: judicialPerson.nickname,
        cuiNumber: judicialPerson.cuiNumber,
      })
      .from(person)
      .leftJoin(judicialPerson, eq(judicialPerson.personId, person.id))
      .where(where)
      .orderBy(person.code)
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ total: count() })
      .from(person)
      .leftJoin(judicialPerson, eq(judicialPerson.personId, person.id))
      .where(where),
  ]);

  return { items, total: totals[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Get by id (full record: person + judicial_person + addresses + contact names)
// ---------------------------------------------------------------------------

export type JudicialPersonFull = {
  person: typeof person.$inferSelect;
  judicial: typeof judicialPerson.$inferSelect | null;
  addresses: (typeof address.$inferSelect)[];
  /** Display name of the linked contact person 1, or null if not set. */
  contactPerson1Name: string | null;
  /** Display name of the linked contact person 2, or null if not set. */
  contactPerson2Name: string | null;
  /** Name of the linked judicial person type, or null if not set. */
  judicialPersonTypeName: string | null;
};

export async function getJudicialPersonById(
  id: string,
): Promise<JudicialPersonFull | null> {
  const personRows = await db
    .select()
    .from(person)
    .where(
      and(
        eq(person.id, id),
        eq(person.type, "JUDICIAL"),
        isNull(person.deletedAt),
      ),
    )
    .limit(1);

  if (personRows.length === 0) return null;
  const personRow = personRows[0];

  // Aliases for the two contact-person joins.
  const cp1 = alias(person, "cp1");
  const cp2 = alias(person, "cp2");

  const [judicialRows, addressRows] = await Promise.all([
    db
      .select()
      .from(judicialPerson)
      .where(eq(judicialPerson.personId, id))
      .limit(1),
    db
      .select()
      .from(address)
      .where(eq(address.personId, id))
      .orderBy(address.kind),
  ]);

  const judicialRow = judicialRows[0] ?? null;

  // Resolve contact person names + judicial person type name if set.
  let contactPerson1Name: string | null = null;
  let contactPerson2Name: string | null = null;
  let judicialPersonTypeName: string | null = null;

  if (judicialRow) {
    if (judicialRow.contactPerson1Id) {
      const rows = await db
        .select({ displayName: cp1.displayName })
        .from(cp1)
        .where(eq(cp1.id, judicialRow.contactPerson1Id))
        .limit(1);
      contactPerson1Name = rows[0]?.displayName ?? null;
    }
    if (judicialRow.contactPerson2Id) {
      const rows = await db
        .select({ displayName: cp2.displayName })
        .from(cp2)
        .where(eq(cp2.id, judicialRow.contactPerson2Id))
        .limit(1);
      contactPerson2Name = rows[0]?.displayName ?? null;
    }
    if (judicialRow.judicialPersonTypeId) {
      const rows = await db
        .select({ name: lookupJudicialPersonType.name })
        .from(lookupJudicialPersonType)
        .where(eq(lookupJudicialPersonType.id, judicialRow.judicialPersonTypeId))
        .limit(1);
      judicialPersonTypeName = rows[0]?.name ?? null;
    }
  }

  return {
    person: personRow,
    judicial: judicialRow,
    addresses: addressRows,
    contactPerson1Name,
    contactPerson2Name,
    judicialPersonTypeName,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createJudicialPerson(
  input: JudicialPersonCreate,
): Promise<JudicialPersonFull> {
  const {
    addresses: addressList,
    notes,
    contactPerson1Id,
    contactPerson2Id,
    correspondenceSameAsHq,
    ...judFields
  } = input;
  // displayName is cached on the person row; for judicial persons it
  // mirrors the `name` field 1:1.
  const displayName = judFields.name.trim() || "(unnamed)";

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
        type: "JUDICIAL",
        displayName,
        notes: notes ?? null,
      })
      .returning();

    const [jRow] = await tx
      .insert(judicialPerson)
      .values({
        personId: pRow.id,
        name: judFields.name,
        nickname: judFields.nickname ?? null,
        judicialPersonTypeId: judFields.judicialPersonTypeId ?? null,
        cuiNumber: judFields.cuiNumber ?? null,
        tradeRegisterNumber: judFields.tradeRegisterNumber ?? null,
        contactPerson1Id: contactPerson1Id ?? null,
        contactPerson2Id: contactPerson2Id ?? null,
        correspondenceSameAsHq: correspondenceSameAsHq ?? false,
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

    return {
      person: pRow,
      judicial: jRow,
      addresses: addressRows,
      contactPerson1Name: null, // freshly created, won't resolve names here
      contactPerson2Name: null,
      judicialPersonTypeName: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Update — partial, with merge-by-kind addresses semantics
// ---------------------------------------------------------------------------

export async function updateJudicialPerson(
  id: string,
  input: JudicialPersonUpdate,
): Promise<JudicialPersonFull | null> {
  const {
    addresses: addressList,
    notes,
    contactPerson1Id,
    contactPerson2Id,
    correspondenceSameAsHq,
    ...judUpdate
  } = input;

  return await db.transaction(async (tx) => {
    // Verify person exists, is judicial, and is not deleted.
    const personRows = await tx
      .select()
      .from(person)
      .where(
        and(
          eq(person.id, id),
          eq(person.type, "JUDICIAL"),
          isNull(person.deletedAt),
        ),
      )
      .limit(1);
    if (personRows.length === 0) return null;

    // Build the judicial_person patch, including new FK + flag fields.
    const judicialPatch: Record<string, unknown> = { ...judUpdate };
    if (contactPerson1Id !== undefined) judicialPatch.contactPerson1Id = contactPerson1Id ?? null;
    if (contactPerson2Id !== undefined) judicialPatch.contactPerson2Id = contactPerson2Id ?? null;
    if (correspondenceSameAsHq !== undefined) judicialPatch.correspondenceSameAsHq = correspondenceSameAsHq;

    const hasJudUpdate = Object.values(judicialPatch).some((v) => v !== undefined);
    if (hasJudUpdate) {
      await tx
        .update(judicialPerson)
        .set(judicialPatch)
        .where(eq(judicialPerson.personId, id));
    }

    // Cached display_name mirrors `name` 1:1 — refresh whenever name changed
    // or notes changed.
    const needsDisplayNameRefresh = judUpdate.name !== undefined;

    if (needsDisplayNameRefresh || notes !== undefined) {
      const personPatch: Partial<typeof person.$inferInsert> = {};
      if (notes !== undefined) personPatch.notes = notes ?? null;
      if (needsDisplayNameRefresh) {
        const fresh = await tx
          .select({ name: judicialPerson.name })
          .from(judicialPerson)
          .where(eq(judicialPerson.personId, id))
          .limit(1);
        const newDisplay = (fresh[0]?.name ?? "").trim() || "(unnamed)";
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

    // Re-fetch full record (includes contact person name resolution).
    return getJudicialPersonById(id);
  });
}
