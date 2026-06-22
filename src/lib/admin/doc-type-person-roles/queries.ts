/**
 * Query helpers for the lookup_doc_type_person_role junction table.
 *
 * Each row associates one lookup_document_type with one lookup_person_role.
 * List queries join both sides so the caller receives display names directly.
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  lookupDocTypePersonRole,
  lookupDocumentType,
  lookupPersonRole,
} from "@/db/schema";

// ── Row type returned by list / create ────────────────────────────────────────

export type DocTypePersonRoleRow = {
  id: string;
  documentTypeId: string;
  personRoleId: string;
  documentTypeName: string;
  personRoleName: string;
};

// ── List ──────────────────────────────────────────────────────────────────────

export async function listDocTypePersonRoles(): Promise<DocTypePersonRoleRow[]> {
  const rows = await db
    .select({
      id:               lookupDocTypePersonRole.id,
      documentTypeId:   lookupDocTypePersonRole.documentTypeId,
      personRoleId:     lookupDocTypePersonRole.personRoleId,
      documentTypeName: lookupDocumentType.name,
      personRoleName:   lookupPersonRole.name,
    })
    .from(lookupDocTypePersonRole)
    .innerJoin(
      lookupDocumentType,
      eq(lookupDocTypePersonRole.documentTypeId, lookupDocumentType.id),
    )
    .innerJoin(
      lookupPersonRole,
      eq(lookupDocTypePersonRole.personRoleId, lookupPersonRole.id),
    )
    .orderBy(asc(lookupDocumentType.name), asc(lookupPersonRole.name));

  return rows;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createDocTypePersonRole(data: {
  documentTypeId: string;
  personRoleId: string;
}): Promise<DocTypePersonRoleRow> {
  const [inserted] = await db
    .insert(lookupDocTypePersonRole)
    .values(data)
    .returning();

  // Re-fetch with joined names so the response shape matches the list.
  const [row] = await db
    .select({
      id:               lookupDocTypePersonRole.id,
      documentTypeId:   lookupDocTypePersonRole.documentTypeId,
      personRoleId:     lookupDocTypePersonRole.personRoleId,
      documentTypeName: lookupDocumentType.name,
      personRoleName:   lookupPersonRole.name,
    })
    .from(lookupDocTypePersonRole)
    .innerJoin(
      lookupDocumentType,
      eq(lookupDocTypePersonRole.documentTypeId, lookupDocumentType.id),
    )
    .innerJoin(
      lookupPersonRole,
      eq(lookupDocTypePersonRole.personRoleId, lookupPersonRole.id),
    )
    .where(eq(lookupDocTypePersonRole.id, inserted.id));

  return row;
}

// ── Distinct person roles across all document types ───────────────────────────
//
// Used by the "associate document to person" page: the document type is not
// known at association time, so we offer the full curated set of roles that
// appear in any document-type association rather than filtering by one type.

export type DistinctDocPersonRole = { id: string; name: string };

export async function listDistinctDocPersonRoles(): Promise<DistinctDocPersonRole[]> {
  const rows = await db
    .selectDistinct({
      id:   lookupPersonRole.id,
      name: lookupPersonRole.name,
    })
    .from(lookupDocTypePersonRole)
    .innerJoin(
      lookupPersonRole,
      eq(lookupDocTypePersonRole.personRoleId, lookupPersonRole.id),
    )
    .orderBy(asc(lookupPersonRole.name));

  return rows;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDocTypePersonRole(id: string): Promise<boolean> {
  const result = await db
    .delete(lookupDocTypePersonRole)
    .where(eq(lookupDocTypePersonRole.id, id))
    .returning({ id: lookupDocTypePersonRole.id });

  return result.length > 0;
}
