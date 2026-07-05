/**
 * DB query helpers for the Document API.
 *
 * Soft delete: list + getById filter out deleted rows.
 *
 * NOTE (Slice #15.05): document types are no longer a hardcoded enum — they
 * are rows in `lookup_document_type`, managed via Administration → Reference
 * Data, referenced here via `documentTypeId` (a plain uuid FK). Per standing
 * rule: new type values are added by Adrian (or by Claude only when
 * explicitly directed) — never auto-seeded by application code.
 */

import { asc, and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { document, documentVersion, entityMetadata, groupMember, groups, lookupDocumentType, person, principalObject } from "@/db/schema";
import type {
  DocumentCreate,
  DocumentListQuery,
  DocumentSnapshot,
  DocumentUpdate,
} from "./validation";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type DocumentListItem = {
  id:               string;
  code:             string;
  documentTypeId:   string;
  documentTypeName: string | null;
  title:            string | null;
  nrDocument:       string | null;
  dateDocument:     string | null;
  /** Metadata fields (always fetched via LEFT JOIN; null when no metadata row exists). */
  importance:       string | null;
  relevance:        string | null;
  provenance:       string | null;
  createdAt:        Date;
  updatedAt:        Date;
};

export type DocumentFull = typeof document.$inferSelect;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listDocument(opts: DocumentListQuery): Promise<{
  items: DocumentListItem[];
  total: number;
}> {
  const q   = opts.q?.trim();
  const pat = q ? `%${q}%` : null;

  // Short-circuit: if documentTypeIds array is explicitly empty, return nothing.
  if (opts.documentTypeIds !== undefined && opts.documentTypeIds.length === 0) {
    return { items: [], total: 0 };
  }

  // Slice #18.17: Groups filter.
  // groupCodes undefined → no filter.
  // groupCodes []       → show documents with no DOCUMENT group only.
  // groupCodes [...]    → filter to those codes; also include ungrouped unless
  //                       opts.includeUngrouped is explicitly false.
  // NOTE: literal "document.id" in sql`` templates avoids the Drizzle unqualified-
  // column gotcha (groups alias g_f has id in scope; bare "id" would resolve there).
  let groupFilter: ReturnType<typeof sql> | undefined = undefined;
  if (opts.groupCodes !== undefined) {
    const hasNoGroup = sql`NOT EXISTS (
      SELECT 1 FROM ${groupMember} gm_f
      JOIN ${groups} g_f ON g_f.id = gm_f.group_id
      WHERE gm_f.principal_object_id = document.principal_object_id
        AND g_f.target_type = 'DOCUMENT'
    )`;
    const hasMatchingCode = sql`EXISTS (
      SELECT 1 FROM ${groupMember} gm_f2
      JOIN ${groups} g_f2 ON g_f2.id = gm_f2.group_id
      WHERE gm_f2.principal_object_id = document.principal_object_id
        AND g_f2.code = ANY(ARRAY[${sql.join(
          opts.groupCodes.map((c) => sql`${c}`),
          sql`, `,
        )}]::text[])
    )`;
    if (opts.groupCodes.length === 0 && opts.includeUngrouped === false) {
      groupFilter = sql`1 = 0`;
    } else if (opts.groupCodes.length === 0) {
      groupFilter = hasNoGroup;
    } else if (opts.includeUngrouped === false) {
      groupFilter = hasMatchingCode;
    } else {
      groupFilter = sql`(${hasNoGroup} OR ${hasMatchingCode})`;
    }
  }

  const where = and(
    isNull(document.deletedAt),
    opts.documentTypeIds && opts.documentTypeIds.length > 0
      ? inArray(document.documentTypeId, opts.documentTypeIds)
      : undefined,
    groupFilter,
    pat
      ? or(
          ilike(document.code,       pat),
          ilike(document.title,      pat),
          ilike(document.nrDocument, pat),
        )
      : undefined,
  );

  const [items, totals] = await Promise.all([
    db
      .select({
        id:               document.id,
        code:             document.code,
        documentTypeId:   document.documentTypeId,
        documentTypeName: lookupDocumentType.name,
        title:            document.title,
        nrDocument:       document.nrDocument,
        dateDocument:     document.dateDocument,
        importance:       entityMetadata.importance,
        relevance:        entityMetadata.relevance,
        provenance:       entityMetadata.provenance,
        createdAt:        document.createdAt,
        updatedAt:        document.updatedAt,
      })
      .from(document)
      .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
      .leftJoin(entityMetadata, eq(entityMetadata.principalObjectId, document.principalObjectId))
      .where(where)
      // Slice #16.UX.01: most-recently modified/created first.
      .orderBy(sql`greatest(${document.updatedAt}, ${document.createdAt}) desc`)
      .limit(opts.limit)
      .offset(opts.offset),

    db
      .select({ total: count() })
      .from(document)
      .where(where),
  ]);

  return { items: items as DocumentListItem[], total: totals[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Get by id (full record)
// ---------------------------------------------------------------------------

export async function getDocumentById(
  id: string,
): Promise<DocumentFull | null> {
  const rows = await db
    .select()
    .from(document)
    .where(and(eq(document.id, id), isNull(document.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Version snapshots  (Slice #18.06)
// ---------------------------------------------------------------------------

export type DocumentVersionItem = {
  versionNumber: number;
  snapshot:      DocumentSnapshot;
  createdAt:     Date;
};

const SNAPSHOT_KEYS: (keyof DocumentSnapshot)[] = [
  "documentTypeId", "title", "nrDocument", "dateDocument", "institutionId",
  "emitent", "bazaLegala", "uatProprietate", "uatProprietar", "suprafata",
  "nrDosarSuccesoral", "dataDecesului", "ultimulDomiciliu", "nrCertificatDeces",
  "dateStart", "dateEnd", "notes",
  // Slice #19.03
  "subject", "dateValidUntil", "surveyorId",
];

/** Build the canonical document snapshot from a freshly-fetched record. */
export function snapshotFromFull(full: DocumentFull): DocumentSnapshot {
  return {
    documentTypeId:    full.documentTypeId    ?? null,
    title:             full.title             ?? null,
    nrDocument:        full.nrDocument        ?? null,
    dateDocument:      full.dateDocument      ?? null,
    // Slice #18.16.VL: was `institution` (free text); now FK uuid.
    institutionId:     full.institutionId     ?? null,
    emitent:           full.emitent           ?? null,
    bazaLegala:        full.bazaLegala        ?? null,
    uatProprietate:    full.uatProprietate    ?? null,
    uatProprietar:     full.uatProprietar     ?? null,
    // numeric column → drizzle returns string | null; keep as-is.
    suprafata:         full.suprafata         ?? null,
    nrDosarSuccesoral: full.nrDosarSuccesoral ?? null,
    dataDecesului:     full.dataDecesului     ?? null,
    ultimulDomiciliu:  full.ultimulDomiciliu  ?? null,
    nrCertificatDeces: full.nrCertificatDeces ?? null,
    dateStart:         full.dateStart         ?? null,
    dateEnd:           full.dateEnd           ?? null,
    notes:             full.notes             ?? null,
    // Slice #19.03
    subject:           full.subject           ?? null,
    dateValidUntil:    full.dateValidUntil     ?? null,
    surveyorId:        full.surveyorId         ?? null,
  };
}

// ---------------------------------------------------------------------------
// Get by id — extended with surveyor display info (Slice #19.03)
// ---------------------------------------------------------------------------

export type DocumentWithSurveyor = DocumentFull & {
  surveyorDisplayName: string | null;
  surveyorPersonType:  "NATURAL" | "JUDICIAL" | null;
};

export async function getDocumentWithSurveyor(
  id: string,
): Promise<DocumentWithSurveyor | null> {
  const rows = await db
    .select()
    .from(document)
    .where(and(eq(document.id, id), isNull(document.deletedAt)))
    .limit(1);

  const doc = rows[0] ?? null;
  if (!doc) return null;

  let surveyorDisplayName: string | null = null;
  let surveyorPersonType:  "NATURAL" | "JUDICIAL" | null = null;

  if (doc.surveyorId) {
    const pRows = await db
      .select({ displayName: person.displayName, type: person.type })
      .from(person)
      .where(and(eq(person.id, doc.surveyorId), isNull(person.deletedAt)))
      .limit(1);
    if (pRows[0]) {
      surveyorDisplayName = pRows[0].displayName;
      surveyorPersonType  = pRows[0].type as "NATURAL" | "JUDICIAL";
    }
  }

  return { ...doc, surveyorDisplayName, surveyorPersonType };
}

/**
 * Field-by-field equality of two snapshots — used to skip writing a new version
 * when a save produced no actual change (no-op backstop). Compared explicitly
 * rather than via JSON.stringify because Postgres jsonb does not preserve
 * object key order.
 */
function snapshotsEqual(a: DocumentSnapshot, b: DocumentSnapshot): boolean {
  for (const k of SNAPSHOT_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/** All versions of a document, oldest (version 0) first. */
export async function listDocumentVersions(
  documentId: string,
): Promise<DocumentVersionItem[]> {
  const rows = await db
    .select({
      versionNumber: documentVersion.versionNumber,
      snapshot:      documentVersion.snapshot,
      createdAt:     documentVersion.createdAt,
    })
    .from(documentVersion)
    .where(eq(documentVersion.documentId, documentId))
    .orderBy(documentVersion.versionNumber);

  return rows.map((r) => ({
    versionNumber: r.versionNumber,
    snapshot:      r.snapshot as DocumentSnapshot,
    createdAt:     r.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createDocument(
  input: DocumentCreate,
  updatedBy: string | null = null,
): Promise<DocumentFull> {
  return await db.transaction(async (tx) => {
    // Allocate a code from the shared sequence via the principal_object row.
    const [poRow] = await tx
      .insert(principalObject)
      .values({
        objectType: "DOCUMENT",
        code: sql`'DOC' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
      })
      .returning();

    const [row] = await tx
      .insert(document)
      .values({
        ...inputToValues(input),
        principalObjectId: poRow.id,
        code: poRow.code,
        updatedBy,
      })
      .returning();

    // Slice #18.06: record version 0 — the state at creation.
    await tx.insert(documentVersion).values({
      documentId:    row.id,
      versionNumber: 0,
      snapshot:      snapshotFromFull(row),
      updatedBy,
    });

    return row;
  });
}

// ---------------------------------------------------------------------------
// Update — partial patch
// ---------------------------------------------------------------------------

export async function updateDocument(
  id:    string,
  input: DocumentUpdate,
  updatedBy: string | null = null,
): Promise<DocumentFull | null> {
  return await db.transaction(async (tx) => {
    // Verify exists and not deleted.
    const existing = await tx
      .select({ id: document.id })
      .from(document)
      .where(and(eq(document.id, id), isNull(document.deletedAt)))
      .limit(1);

    if (existing.length === 0) return null;

    // Always include updatedBy so the audit trail is always current.
    const patch: Partial<typeof document.$inferInsert> = { updatedBy };

    if (input.documentTypeId !== undefined) patch.documentTypeId = input.documentTypeId;
    if (input.title          !== undefined) patch.title          = input.title          ?? null;
    if (input.nrDocument     !== undefined) patch.nrDocument     = input.nrDocument     ?? null;
    if (input.dateDocument   !== undefined) patch.dateDocument   = input.dateDocument   ?? null;
    // Slice #18.16.VL: institution is now a FK uuid column.
    if (input.institutionId  !== undefined) patch.institutionId  = input.institutionId  ?? null;

    if (input.emitent        !== undefined) patch.emitent        = input.emitent        ?? null;
    if (input.bazaLegala     !== undefined) patch.bazaLegala     = input.bazaLegala     ?? null;
    if (input.uatProprietate !== undefined) patch.uatProprietate = input.uatProprietate ?? null;
    if (input.uatProprietar  !== undefined) patch.uatProprietar  = input.uatProprietar  ?? null;
    if (input.suprafata      !== undefined) {
      patch.suprafata = input.suprafata != null ? String(input.suprafata) : null;
    }

    if (input.nrDosarSuccesoral !== undefined) patch.nrDosarSuccesoral = input.nrDosarSuccesoral ?? null;
    if (input.dataDecesului     !== undefined) patch.dataDecesului     = input.dataDecesului     ?? null;
    if (input.ultimulDomiciliu  !== undefined) patch.ultimulDomiciliu  = input.ultimulDomiciliu  ?? null;
    if (input.nrCertificatDeces !== undefined) patch.nrCertificatDeces = input.nrCertificatDeces ?? null;

    if (input.dateStart !== undefined) patch.dateStart = input.dateStart ?? null;
    if (input.dateEnd   !== undefined) patch.dateEnd   = input.dateEnd   ?? null;

    if (input.titularText  !== undefined) patch.titularText  = input.titularText  ?? null;
    if (input.defunctText  !== undefined) patch.defunctText  = input.defunctText  ?? null;
    if (input.partiesAText !== undefined) patch.partiesAText = input.partiesAText ?? null;
    if (input.partiesBText !== undefined) patch.partiesBText = input.partiesBText ?? null;

    if (input.notes !== undefined) patch.notes = input.notes ?? null;

    // Slice #19.03
    if (input.subject        !== undefined) patch.subject        = input.subject        ?? null;
    if (input.dateValidUntil !== undefined) patch.dateValidUntil = input.dateValidUntil ?? null;
    if (input.surveyorId     !== undefined) patch.surveyorId     = input.surveyorId     ?? null;

    // patch always has at least updatedBy
    await tx.update(document).set(patch).where(eq(document.id, id));

    const [updated] = await tx
      .select()
      .from(document)
      .where(eq(document.id, id))
      .limit(1);

    if (!updated) return null;

    // Slice #18.06: append a new version snapshot — but skip if this save
    // produced no actual change vs the latest stored version (no-op backstop).
    const newSnapshot = snapshotFromFull(updated);
    const [latestVer] = await tx
      .select({
        versionNumber: documentVersion.versionNumber,
        snapshot:      documentVersion.snapshot,
      })
      .from(documentVersion)
      .where(eq(documentVersion.documentId, id))
      .orderBy(desc(documentVersion.versionNumber))
      .limit(1);

    const latestSnapshot = latestVer
      ? (latestVer.snapshot as DocumentSnapshot)
      : null;

    if (!latestSnapshot || !snapshotsEqual(latestSnapshot, newSnapshot)) {
      await tx.insert(documentVersion).values({
        documentId:    id,
        versionNumber: (latestVer?.versionNumber ?? -1) + 1,
        snapshot:      newSnapshot,
        updatedBy,
      });
    }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export async function softDeleteDocument(id: string): Promise<boolean> {
  const result = await db
    .update(document)
    .set({ deletedAt: new Date() })
    .where(and(eq(document.id, id), isNull(document.deletedAt)))
    .returning({ id: document.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Internal helper — maps validated input to DB insert values
// ---------------------------------------------------------------------------

function inputToValues(
  input: DocumentCreate,
): Omit<typeof document.$inferInsert, "id" | "code" | "principalObjectId" | "createdAt" | "updatedAt" | "deletedAt"> {
  return {
    documentTypeId: input.documentTypeId,
    title:          input.title        ?? null,
    nrDocument:     input.nrDocument   ?? null,
    dateDocument:   input.dateDocument ?? null,
    // Slice #18.16.VL: institution is now a FK uuid column.
    institutionId:  input.institutionId ?? null,

    emitent:        input.emitent        ?? null,
    bazaLegala:     input.bazaLegala     ?? null,
    uatProprietate: input.uatProprietate ?? null,
    uatProprietar:  input.uatProprietar  ?? null,
    suprafata:      input.suprafata != null ? String(input.suprafata) : null,

    nrDosarSuccesoral: input.nrDosarSuccesoral ?? null,
    dataDecesului:     input.dataDecesului     ?? null,
    ultimulDomiciliu:  input.ultimulDomiciliu  ?? null,
    nrCertificatDeces: input.nrCertificatDeces ?? null,

    dateStart: input.dateStart ?? null,
    dateEnd:   input.dateEnd   ?? null,

    titularText:  input.titularText  ?? null,
    defunctText:  input.defunctText  ?? null,
    partiesAText: input.partiesAText ?? null,
    partiesBText: input.partiesBText ?? null,

    notes: input.notes ?? null,

    // Slice #19.03
    subject:        input.subject        ?? null,
    dateValidUntil: input.dateValidUntil ?? null,
    surveyorId:     input.surveyorId     ?? null,
  };
}

// ---------------------------------------------------------------------------
// Document search  (used by associate-document flows)
// ---------------------------------------------------------------------------

import {
  property,
  propertyDocument,
  personDocument,
  documentDocument,
  lookupPersonRole,
  lookupDocTypePersonRole,
} from "@/db/schema";

export type DocumentSearchItem = {
  id:             string;
  code:           string;
  documentTypeId: string;
  typeName:       string | null;
  title:          string | null;
};

export async function searchDocumentAll(opts: {
  q?:     string;
  limit:  number;
  offset: number;
}): Promise<{ items: DocumentSearchItem[]; total: number }> {
  const pat = opts.q?.trim() ? `%${opts.q.trim()}%` : null;

  const where = and(
    isNull(document.deletedAt),
    pat
      ? or(ilike(document.code, pat), ilike(document.title, pat))
      : undefined,
  );

  const [{ value: total }] = await db.select({ value: count() }).from(document).where(where);

  const rows = await db
    .select({
      id:             document.id,
      code:           document.code,
      documentTypeId: document.documentTypeId,
      typeName:       lookupDocumentType.name,
      title:          document.title,
    })
    .from(document)
    .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .where(where)
    .orderBy(document.code)
    .limit(opts.limit)
    .offset(opts.offset);

  return { items: rows as DocumentSearchItem[], total };
}

// ---------------------------------------------------------------------------
// Document <-> Property
// ---------------------------------------------------------------------------

export type DocumentPropertyItem = {
  id:           string;
  code:         string;
  label:        string;   // nickname ?? code
  associatedAt: Date;
};

export async function listDocumentProperties(documentId: string): Promise<DocumentPropertyItem[]> {
  const rows = await db
    .select({
      id:           property.id,
      code:         property.code,
      nickname:     property.nickname,
      associatedAt: propertyDocument.createdAt,
    })
    .from(propertyDocument)
    .innerJoin(property, and(eq(propertyDocument.propertyId, property.id), isNull(property.deletedAt)))
    .where(eq(propertyDocument.documentId, documentId))
    .orderBy(property.code);

  return rows.map((r) => ({ id: r.id, code: r.code, label: r.nickname ?? r.code, associatedAt: r.associatedAt }));
}

export async function associatePropertiesToDocument(documentId: string, propertyIds: string[]): Promise<void> {
  await db.insert(propertyDocument)
    .values(propertyIds.map((pid) => ({ propertyId: pid, documentId })))
    .onConflictDoNothing();
}

export async function dissociatePropertyFromDocument(documentId: string, propertyId: string): Promise<boolean> {
  const result = await db.delete(propertyDocument)
    .where(and(eq(propertyDocument.documentId, documentId), eq(propertyDocument.propertyId, propertyId)))
    .returning({ id: propertyDocument.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Document <-> Person
// ---------------------------------------------------------------------------

export type DocumentPersonItem = {
  id:           string;
  code:         string;
  type:         "NATURAL" | "JUDICIAL";
  displayName:  string;
  quality:      string | null;
  roleName:     string | null;
  associatedAt: Date;
};

export async function listDocumentPersons(documentId: string): Promise<DocumentPersonItem[]> {
  const rows = await db
    .select({
      id:           person.id,
      code:         person.code,
      type:         person.type,
      displayName:  person.displayName,
      quality:      personDocument.quality,
      roleName:     lookupPersonRole.name,
      associatedAt: personDocument.createdAt,
    })
    .from(personDocument)
    .innerJoin(person, and(eq(personDocument.personId, person.id), isNull(person.deletedAt)))
    .leftJoin(lookupPersonRole, eq(personDocument.personRoleId, lookupPersonRole.id))
    .where(eq(personDocument.documentId, documentId))
    .orderBy(person.displayName);

  return rows as DocumentPersonItem[];
}

export async function associatePersonsToDocument(
  documentId:   string,
  personIds:    string[],
  quality?:     string | null,
  personRoleId: string | null = null,
): Promise<void> {
  await db.insert(personDocument)
    .values(personIds.map((pid) => ({
      personId: pid,
      documentId,
      quality: quality ?? null,
      personRoleId,
    })))
    .onConflictDoNothing();
}

// ---------------------------------------------------------------------------
// Valid person roles for a specific document (filtered by document type)
// ---------------------------------------------------------------------------
//
// Slice #15.05: simplified from the old PAPERWORK_TYPE_TO_DOC_TYPE_NAME
// string-matching map — lookup_doc_type_person_role already has a direct FK
// to lookup_document_type.id, and document.documentTypeId is that same FK,
// so this is now a plain join with no name-matching hack.

export type RoleItem = { id: string; name: string };

export async function listPersonRolesForDocument(documentId: string): Promise<RoleItem[]> {
  // 1. Get the document's type id.
  const [doc] = await db
    .select({ documentTypeId: document.documentTypeId })
    .from(document)
    .where(eq(document.id, documentId))
    .limit(1);

  if (!doc) return [];

  // 2a. Fetch roles specific to this document type.
  const rows = await db
    .select({
      id:   lookupPersonRole.id,
      name: lookupPersonRole.name,
    })
    .from(lookupDocTypePersonRole)
    .innerJoin(lookupPersonRole, eq(lookupDocTypePersonRole.personRoleId, lookupPersonRole.id))
    .where(eq(lookupDocTypePersonRole.documentTypeId, doc.documentTypeId))
    .orderBy(asc(lookupPersonRole.name));

  if (rows.length > 0) return rows;

  // 2b. Fallback — this type has no specific mapping (or its mapped list is
  // empty): return all distinct roles across any document type.
  return db
    .selectDistinct({
      id:   lookupPersonRole.id,
      name: lookupPersonRole.name,
    })
    .from(lookupDocTypePersonRole)
    .innerJoin(lookupPersonRole, eq(lookupDocTypePersonRole.personRoleId, lookupPersonRole.id))
    .orderBy(asc(lookupPersonRole.name));
}

export async function dissociatePersonFromDocument(documentId: string, personId: string): Promise<boolean> {
  const result = await db.delete(personDocument)
    .where(and(eq(personDocument.documentId, documentId), eq(personDocument.personId, personId)))
    .returning({ id: personDocument.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Document <-> Document  (self-ref, symmetric)
// ---------------------------------------------------------------------------

export type DocumentRefItem = {
  id:             string;
  code:           string;
  documentTypeId: string;
  typeName:       string | null;
  title:          string | null;
  associatedAt:   Date;
};

export async function listDocumentReferences(documentId: string): Promise<DocumentRefItem[]> {
  const rows = await db
    .select({
      documentIdA:  documentDocument.documentIdA,
      documentIdB:  documentDocument.documentIdB,
      associatedAt: documentDocument.createdAt,
      id:             document.id,
      code:           document.code,
      documentTypeId: document.documentTypeId,
      typeName:       lookupDocumentType.name,
      title:          document.title,
    })
    .from(documentDocument)
    .innerJoin(
      document,
      and(
        or(
          and(eq(documentDocument.documentIdA, documentId), eq(document.id, documentDocument.documentIdB)),
          and(eq(documentDocument.documentIdB, documentId), eq(document.id, documentDocument.documentIdA)),
        ),
        isNull(document.deletedAt),
      ),
    )
    .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .where(or(eq(documentDocument.documentIdA, documentId), eq(documentDocument.documentIdB, documentId)))
    .orderBy(document.code);

  return rows.map((r) => ({
    id: r.id, code: r.code, documentTypeId: r.documentTypeId, typeName: r.typeName, title: r.title, associatedAt: r.associatedAt,
  }));
}

export async function associateDocumentToDocument(documentId: string, otherIds: string[]): Promise<void> {
  const values = otherIds
    .filter((id) => id !== documentId)
    .map((otherId) => {
      const [a, b] = [documentId, otherId].sort();
      return { documentIdA: a, documentIdB: b };
    });
  if (values.length === 0) return;
  await db.insert(documentDocument).values(values).onConflictDoNothing();
}

export async function dissociateDocumentFromDocument(documentId: string, otherId: string): Promise<boolean> {
  const [a, b] = [documentId, otherId].sort();
  const result = await db.delete(documentDocument)
    .where(and(eq(documentDocument.documentIdA, a), eq(documentDocument.documentIdB, b)))
    .returning({ id: documentDocument.id });
  return result.length > 0;
}
