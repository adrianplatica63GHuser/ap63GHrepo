/**
 * Reading and writing an identity document's values.                    (Slice 40.82)
 *
 * `identity_document` is 1:1 with `document` (document_id the primary key, ON DELETE CASCADE) and holds what the
 * document's common columns do not. These functions are its only writers; every write is judged first by
 * `checkIdentityWrite` (./validation). They take the caller's connection, because a document and its identity
 * values are written in one transaction (`createDocument` / `updateDocument` in src/lib/documents/queries.ts).
 */
import { and, eq, inArray, notExists } from "drizzle-orm";
import { db, type DbTransaction } from "@/db";
import { document, documentPage, identityDocument, lookupDocumentType, personDocument } from "@/db/schema";
import { IDENTITY_VALUE_KEYS, isIdentityKind, type IdentityKind } from "./kinds";
import {
  emptyIdentityValues,
  identityWarnings,
  type IdentityRefusalCode,
  type IdentityValues,
  type IdentityWarning,
} from "./validation";
import type { IdentityValueKey } from "./kinds";

type Conn = DbTransaction | typeof db;

type IdentityRow = typeof identityDocument.$inferSelect;

function valuesFromRow(row: IdentityRow): IdentityValues {
  const out = emptyIdentityValues() as Record<IdentityValueKey, string | null>;
  for (const k of IDENTITY_VALUE_KEYS) out[k] = (row[k] as string | null) ?? null;
  return out as IdentityValues;
}

/** The kind of this document type, read off its marker; null for an ordinary type or no such type. */
export async function identityKindOfTypeId(conn: Conn, documentTypeId: string): Promise<IdentityKind | null> {
  const [row] = await conn
    .select({ identityKind: lookupDocumentType.identityKind })
    .from(lookupDocumentType)
    .where(eq(lookupDocumentType.id, documentTypeId))
    .limit(1);
  return row && isIdentityKind(row.identityKind) ? row.identityKind : null;
}

/** This document's identity values, or null when it has no row. */
export async function getIdentityValues(conn: Conn, documentId: string): Promise<IdentityValues | null> {
  const [row] = await conn.select().from(identityDocument).where(eq(identityDocument.documentId, documentId)).limit(1);
  return row ? valuesFromRow(row) : null;
}

/** The identity values of each of these documents that has a row. */
export async function getIdentityValuesFor(conn: Conn, documentIds: readonly string[]): Promise<Map<string, IdentityValues>> {
  if (documentIds.length === 0) return new Map();
  const rows = await conn.select().from(identityDocument).where(inArray(identityDocument.documentId, [...documentIds]));
  return new Map(rows.map((r) => [r.documentId, valuesFromRow(r)]));
}

/** Write the whole row: insert it, or replace every field of the one there. */
export async function putIdentityValues(tx: DbTransaction, documentId: string, values: IdentityValues): Promise<void> {
  const cols = Object.fromEntries(IDENTITY_VALUE_KEYS.map((k) => [k, values[k]])) as Omit<typeof identityDocument.$inferInsert, "documentId">;
  await tx
    .insert(identityDocument)
    .values({ documentId, ...cols })
    .onConflictDoUpdate({ target: identityDocument.documentId, set: { ...cols, updatedAt: new Date() } });
}

/** Remove the row (the document became an ordinary type, holding nothing). */
export async function deleteIdentityValues(tx: DbTransaction, documentId: string): Promise<void> {
  await tx.delete(identityDocument).where(eq(identityDocument.documentId, documentId));
}

/** What GET /api/documents/[id] returns under `identity`: null on an ordinary type. */
export type IdentityBlock = {
  kind: IdentityKind;
  values: IdentityValues;
  warnings: IdentityWarning[];
};

export async function identityBlockFor(conn: Conn, documentId: string, documentTypeId: string): Promise<IdentityBlock | null> {
  const kind = await identityKindOfTypeId(conn, documentTypeId);
  if (kind === null) return null;
  const values = (await getIdentityValues(conn, documentId)) ?? emptyIdentityValues();
  return { kind, values, warnings: identityWarnings(values) };
}

/** A write the identity rules refuse. The document routes answer it 400 with its code and the fields it names. */
export class IdentityWriteRefusedError extends Error {
  constructor(
    readonly code: IdentityRefusalCode,
    readonly fields: readonly string[],
  ) {
    super(code);
    this.name = "IdentityWriteRefusedError";
  }
}

export function identityRefusalToResponse(err: unknown): Response | null {
  if (!(err instanceof IdentityWriteRefusedError)) return null;
  return Response.json({ error: err.message, code: err.code, fields: err.fields }, { status: 400 });
}

/**
 * The pageless identity documents migration_118 made from these persons' „Act de identitate", untouched since
 * (`updated_by` still the migration's). What the dev seeds' removers delete with the persons they made, so a
 * seed:dev:remove leaves no document behind that the seed's persons were the reason for.
 */
export async function identityDocumentsMadeByMigration(personIds: readonly string[]): Promise<string[]> {
  if (personIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ id: document.id })
    .from(document)
    .innerJoin(personDocument, eq(personDocument.documentId, document.id))
    .where(
      and(
        inArray(personDocument.personId, [...personIds]),
        eq(document.updatedBy, "migration_118"),
        notExists(db.select({ x: documentPage.id }).from(documentPage).where(eq(documentPage.documentId, document.id))),
      ),
    );
  return rows.map((r) => r.id);
}
