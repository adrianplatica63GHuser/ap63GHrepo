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

import { and, count, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { address, naturalPerson, person } from "@/db/schema";
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
};

export async function listPersons(opts: ListQuery): Promise<{
  items: PersonListItem[];
  total: number;
}> {
  const q = opts.q?.trim();
  const searchPattern = q ? `%${q}%` : null;

  const where = and(
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
      })
      .from(person)
      .leftJoin(naturalPerson, eq(naturalPerson.personId, person.id))
      .where(where)
      .orderBy(person.code)
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
    const [pRow] = await tx
      .insert(person)
      .values({
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
