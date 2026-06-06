/**
 * DB query helpers for the Paperwork API.
 *
 * Soft delete: list + getById filter out deleted rows.
 */

import { asc, and, count, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { paperwork, principalObject } from "@/db/schema";
import type {
  PaperworkCreate,
  PaperworkListQuery,
  PaperworkType,
  PaperworkUpdate,
} from "./validation";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type PaperworkListItem = {
  id:           string;
  code:         string;
  type:         PaperworkType;
  title:        string | null;
  nrDocument:   string | null;
  dateDocument: string | null;
  institution:  string | null;
};

export type PaperworkFull = typeof paperwork.$inferSelect;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listPaperwork(opts: PaperworkListQuery): Promise<{
  items: PaperworkListItem[];
  total: number;
}> {
  const q   = opts.q?.trim();
  const pat = q ? `%${q}%` : null;

  // Short-circuit: if types array is explicitly empty, return nothing.
  if (opts.types !== undefined && opts.types.length === 0) {
    return { items: [], total: 0 };
  }

  const where = and(
    isNull(paperwork.deletedAt),
    opts.types && opts.types.length > 0
      ? inArray(paperwork.type, opts.types)
      : undefined,
    pat
      ? or(
          ilike(paperwork.code,       pat),
          ilike(paperwork.title,      pat),
          ilike(paperwork.nrDocument, pat),
          ilike(paperwork.institution, pat),
        )
      : undefined,
  );

  const [items, totals] = await Promise.all([
    db
      .select({
        id:           paperwork.id,
        code:         paperwork.code,
        type:         paperwork.type,
        title:        paperwork.title,
        nrDocument:   paperwork.nrDocument,
        dateDocument: paperwork.dateDocument,
        institution:  paperwork.institution,
      })
      .from(paperwork)
      .where(where)
      .orderBy(paperwork.code)
      .limit(opts.limit)
      .offset(opts.offset),

    db
      .select({ total: count() })
      .from(paperwork)
      .where(where),
  ]);

  return { items: items as PaperworkListItem[], total: totals[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Get by id (full record)
// ---------------------------------------------------------------------------

export async function getPaperworkById(
  id: string,
): Promise<PaperworkFull | null> {
  const rows = await db
    .select()
    .from(paperwork)
    .where(and(eq(paperwork.id, id), isNull(paperwork.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createPaperwork(
  input: PaperworkCreate,
): Promise<PaperworkFull> {
  return await db.transaction(async (tx) => {
    // Allocate a code from the shared sequence via the principal_object row.
    const [poRow] = await tx
      .insert(principalObject)
      .values({
        objectType: "PAPERWORK",
        code: sql`'PAPR' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
      })
      .returning();

    const [row] = await tx
      .insert(paperwork)
      .values({
        ...inputToValues(input),
        principalObjectId: poRow.id,
        code: poRow.code,
      })
      .returning();
    return row;
  });
}

// ---------------------------------------------------------------------------
// Update — partial patch
// ---------------------------------------------------------------------------

export async function updatePaperwork(
  id:    string,
  input: PaperworkUpdate,
): Promise<PaperworkFull | null> {
  // Verify exists and not deleted.
  const existing = await db
    .select({ id: paperwork.id })
    .from(paperwork)
    .where(and(eq(paperwork.id, id), isNull(paperwork.deletedAt)))
    .limit(1);

  if (existing.length === 0) return null;

  const patch: Partial<typeof paperwork.$inferInsert> = {};

  if (input.type         !== undefined) patch.type         = input.type;
  if (input.title        !== undefined) patch.title        = input.title        ?? null;
  if (input.nrDocument   !== undefined) patch.nrDocument   = input.nrDocument   ?? null;
  if (input.dateDocument !== undefined) patch.dateDocument = input.dateDocument ?? null;
  if (input.institution  !== undefined) patch.institution  = input.institution  ?? null;

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

  if (Object.keys(patch).length > 0) {
    await db.update(paperwork).set(patch).where(eq(paperwork.id, id));
  }

  const [updated] = await db
    .select()
    .from(paperwork)
    .where(eq(paperwork.id, id))
    .limit(1);

  return updated ?? null;
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export async function softDeletePaperwork(id: string): Promise<boolean> {
  const result = await db
    .update(paperwork)
    .set({ deletedAt: new Date() })
    .where(and(eq(paperwork.id, id), isNull(paperwork.deletedAt)))
    .returning({ id: paperwork.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Internal helper — maps validated input to DB insert values
// ---------------------------------------------------------------------------

function inputToValues(
  input: PaperworkCreate,
): Omit<typeof paperwork.$inferInsert, "id" | "code" | "principalObjectId" | "createdAt" | "updatedAt" | "deletedAt"> {
  return {
    type:         input.type,
    title:        input.title        ?? null,
    nrDocument:   input.nrDocument   ?? null,
    dateDocument: input.dateDocument ?? null,
    institution:  input.institution  ?? null,

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
  };
}

// ---------------------------------------------------------------------------
// Paperwork search  (used by associate-paperwork flows)
// ---------------------------------------------------------------------------

import {
  property,
  propertyPaperwork,
  person,
  personPaperwork,
  paperworkPaperwork,
  lookupPersonRole,
  lookupDocTypePersonRole,
  lookupDocumentType,
} from "@/db/schema";

export type PaperworkSearchItem = {
  id:    string;
  code:  string;
  type:  PaperworkType;
  title: string | null;
};

export async function searchPaperworkAll(opts: {
  q?:     string;
  limit:  number;
  offset: number;
}): Promise<{ items: PaperworkSearchItem[]; total: number }> {
  const pat = opts.q?.trim() ? `%${opts.q.trim()}%` : null;

  const where = and(
    isNull(paperwork.deletedAt),
    pat
      ? or(ilike(paperwork.code, pat), ilike(paperwork.title, pat))
      : undefined,
  );

  const [{ value: total }] = await db.select({ value: count() }).from(paperwork).where(where);

  const rows = await db
    .select({ id: paperwork.id, code: paperwork.code, type: paperwork.type, title: paperwork.title })
    .from(paperwork)
    .where(where)
    .orderBy(paperwork.code)
    .limit(opts.limit)
    .offset(opts.offset);

  return { items: rows as PaperworkSearchItem[], total };
}

// ---------------------------------------------------------------------------
// Paperwork <-> Property
// ---------------------------------------------------------------------------

export type PaperworkPropertyItem = {
  id:           string;
  code:         string;
  label:        string;   // nickname ?? code
  associatedAt: Date;
};

export async function listPaperworkProperties(paperworkId: string): Promise<PaperworkPropertyItem[]> {
  const rows = await db
    .select({
      id:           property.id,
      code:         property.code,
      nickname:     property.nickname,
      associatedAt: propertyPaperwork.createdAt,
    })
    .from(propertyPaperwork)
    .innerJoin(property, and(eq(propertyPaperwork.propertyId, property.id), isNull(property.deletedAt)))
    .where(eq(propertyPaperwork.paperworkId, paperworkId))
    .orderBy(property.code);

  return rows.map((r) => ({ id: r.id, code: r.code, label: r.nickname ?? r.code, associatedAt: r.associatedAt }));
}

export async function associatePropertiesToPaperwork(paperworkId: string, propertyIds: string[]): Promise<void> {
  await db.insert(propertyPaperwork)
    .values(propertyIds.map((pid) => ({ propertyId: pid, paperworkId })))
    .onConflictDoNothing();
}

export async function dissociatePropertyFromPaperwork(paperworkId: string, propertyId: string): Promise<boolean> {
  const result = await db.delete(propertyPaperwork)
    .where(and(eq(propertyPaperwork.paperworkId, paperworkId), eq(propertyPaperwork.propertyId, propertyId)))
    .returning({ id: propertyPaperwork.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Paperwork <-> Person
// ---------------------------------------------------------------------------

export type PaperworkPersonItem = {
  id:           string;
  code:         string;
  type:         "NATURAL" | "JUDICIAL";
  displayName:  string;
  quality:      string | null;
  roleName:     string | null;
  associatedAt: Date;
};

export async function listPaperworkPersons(paperworkId: string): Promise<PaperworkPersonItem[]> {
  const rows = await db
    .select({
      id:           person.id,
      code:         person.code,
      type:         person.type,
      displayName:  person.displayName,
      quality:      personPaperwork.quality,
      roleName:     lookupPersonRole.name,
      associatedAt: personPaperwork.createdAt,
    })
    .from(personPaperwork)
    .innerJoin(person, and(eq(personPaperwork.personId, person.id), isNull(person.deletedAt)))
    .leftJoin(lookupPersonRole, eq(personPaperwork.personRoleId, lookupPersonRole.id))
    .where(eq(personPaperwork.paperworkId, paperworkId))
    .orderBy(person.displayName);

  return rows as PaperworkPersonItem[];
}

export async function associatePersonsToPaperwork(
  paperworkId:  string,
  personIds:    string[],
  quality?:     string | null,
  personRoleId: string | null = null,
): Promise<void> {
  await db.insert(personPaperwork)
    .values(personIds.map((pid) => ({
      personId: pid,
      paperworkId,
      quality: quality ?? null,
      personRoleId,
    })))
    .onConflictDoNothing();
}

// ---------------------------------------------------------------------------
// Valid person roles for a specific document (filtered by document type)
// ---------------------------------------------------------------------------
//
// Maps paperwork.type enum values to the corresponding lookup_document_type.name
// in the database. Types with no seed associations return an empty list.
// CERTIFICAT_SARCINI is intentionally omitted until the DB name is confirmed.

const PAPERWORK_TYPE_TO_DOC_TYPE_NAME: Partial<Record<string, string>> = {
  ACT_ADJUDECARE:           "Act de Adjudecare",
  ACT_CADASTRU:             "Act Cadastru",
  AUTORIZATIE:              "Autorizare",
  AVIZ_INSTITUTIE:          "Aviz de Instituție",
  CERTIFICAT_FISCAL:        "Certificat Fiscal",
  CERTIFICAT_MOSTENITOR:    "Certificat de Moștenitor",
  CERTIFICAT_SARCINI:       "Certificat de Bunuri",
  CERTIFICAT_URBANISM:      "Certificat de Urbanism",
  CONTRACT_ARENDA:          "Contract de Arendă",
  CONTRACT_INCHIRIERE:      "Contract de Închiriere",
  CONTRACT_PARTAJ:          "Contract de Partaj",
  CONTRACT_PRESTARI_SERVICII: "Contract de Prestări Servicii",
  CONTRACT_VANZARE:         "Contract de Vânzare",
  EXTRAS_CARTE_FUNCIARA:    "Extras din Carte Funciară",
  EXTRAS_PUG:               "Extras din PUG",
  HOTARARE_JUDECATOREASCA:  "Hotărâre Judecătorească",
  TITLU_PROPRIETATE:        "Titlu de Proprietate",
  // ACT_DONATIE and TESTAMENT have no seed associations — returns empty list
};

export type RoleItem = { id: string; name: string };

export async function listPersonRolesForPaperwork(paperworkId: string): Promise<RoleItem[]> {
  // 1. Get the document's type.
  const [pw] = await db
    .select({ type: paperwork.type })
    .from(paperwork)
    .where(eq(paperwork.id, paperworkId))
    .limit(1);

  if (!pw) return [];

  const docTypeName = PAPERWORK_TYPE_TO_DOC_TYPE_NAME[pw.type];
  if (!docTypeName) return []; // type has no seed associations or name is unconfirmed

  // 2. Fetch roles valid for this document type via the junction table.
  const rows = await db
    .select({
      id:   lookupPersonRole.id,
      name: lookupPersonRole.name,
    })
    .from(lookupDocTypePersonRole)
    .innerJoin(lookupDocumentType, eq(lookupDocTypePersonRole.documentTypeId, lookupDocumentType.id))
    .innerJoin(lookupPersonRole, eq(lookupDocTypePersonRole.personRoleId, lookupPersonRole.id))
    .where(eq(lookupDocumentType.name, docTypeName))
    .orderBy(asc(lookupPersonRole.name));

  return rows;
}

export async function dissociatePersonFromPaperwork(paperworkId: string, personId: string): Promise<boolean> {
  const result = await db.delete(personPaperwork)
    .where(and(eq(personPaperwork.paperworkId, paperworkId), eq(personPaperwork.personId, personId)))
    .returning({ id: personPaperwork.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Paperwork <-> Paperwork  (self-ref, symmetric)
// ---------------------------------------------------------------------------

export type PaperworkRefItem = {
  id:           string;
  code:         string;
  type:         PaperworkType;
  title:        string | null;
  associatedAt: Date;
};

export async function listPaperworkReferences(paperworkId: string): Promise<PaperworkRefItem[]> {
  const rows = await db
    .select({
      paperworkIdA: paperworkPaperwork.paperworkIdA,
      paperworkIdB: paperworkPaperwork.paperworkIdB,
      associatedAt: paperworkPaperwork.createdAt,
      id:           paperwork.id,
      code:         paperwork.code,
      type:         paperwork.type,
      title:        paperwork.title,
    })
    .from(paperworkPaperwork)
    .innerJoin(
      paperwork,
      and(
        or(
          and(eq(paperworkPaperwork.paperworkIdA, paperworkId), eq(paperwork.id, paperworkPaperwork.paperworkIdB)),
          and(eq(paperworkPaperwork.paperworkIdB, paperworkId), eq(paperwork.id, paperworkPaperwork.paperworkIdA)),
        ),
        isNull(paperwork.deletedAt),
      ),
    )
    .where(or(eq(paperworkPaperwork.paperworkIdA, paperworkId), eq(paperworkPaperwork.paperworkIdB, paperworkId)))
    .orderBy(paperwork.code);

  return rows.map((r) => ({
    id: r.id, code: r.code, type: r.type as PaperworkType, title: r.title, associatedAt: r.associatedAt,
  }));
}

export async function associatePaperworkToPaperwork(paperworkId: string, otherIds: string[]): Promise<void> {
  const values = otherIds
    .filter((id) => id !== paperworkId)
    .map((otherId) => {
      const [a, b] = [paperworkId, otherId].sort();
      return { paperworkIdA: a, paperworkIdB: b };
    });
  if (values.length === 0) return;
  await db.insert(paperworkPaperwork).values(values).onConflictDoNothing();
}

export async function dissociatePaperworkFromPaperwork(paperworkId: string, otherId: string): Promise<boolean> {
  const [a, b] = [paperworkId, otherId].sort();
  const result = await db.delete(paperworkPaperwork)
    .where(and(eq(paperworkPaperwork.paperworkIdA, a), eq(paperworkPaperwork.paperworkIdB, b)))
    .returning({ id: paperworkPaperwork.id });
  return result.length > 0;
}
