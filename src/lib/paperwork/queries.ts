/**
 * DB query helpers for the Paperwork API.
 *
 * Soft delete: list + getById filter out deleted rows.
 */

import { and, count, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { paperwork } from "@/db/schema";
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
  const [row] = await db
    .insert(paperwork)
    .values(inputToValues(input))
    .returning();
  return row;
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
): typeof paperwork.$inferInsert {
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
