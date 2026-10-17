/**
 * Tarlale as objects — the list, one tarla, its properties, its documents, its outline.      (Slice #39.67)
 *
 * A tarla is lighter than a principal object (Adrian: „its own page, but no groups or interactions until you need
 * them"): it stays a row of `lookup_tarla`, edited in „Date de referință" as before, and gains a page of its own
 * with its notes, its properties, their documents and an optional outline (`tarla_corner`, property_corner's shape).
 *
 * ⚠️ **One write door for the row.** A save from the page goes through `writeTarlaRow`
 * (src/lib/admin/value-lists/queries.ts), the door Reference Data's „Adaugă" and „Editează" use — the same fold,
 * the same locks, and since #39.67 the same per-locality rule — with the outline replaced inside that transaction.
 */
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  document,
  lookupDocumentType,
  lookupPropertyType,
  lookupTarla,
  property,
  propertyAddress,
  propertyDocument,
  tarlaCorner,
} from "@/db/schema";
import { writeTarlaRow } from "@/lib/admin/value-lists/queries";

import type {
  TarlaDocumentItem,
  TarlaFull,
  TarlaListItem,
  TarlaPropertyItem,
  TarlaUpdate,
} from "./types";

export type { TarlaCornerItem, TarlaDocumentItem, TarlaFull, TarlaListItem, TarlaPropertyItem, TarlaUpdate } from "./types";

/** Every tarla, by locality then code (code by its natural order: T2 before T10), with its counts. */
export async function listTarlale(): Promise<TarlaListItem[]> {
  const rows = await db
    .select({
      id: lookupTarla.id,
      indicativ: lookupTarla.indicativ,
      locality: lookupTarla.locality,
      county: lookupTarla.county,
      descriere: lookupTarla.descriere,
      origin: lookupTarla.origin,
      // Qualified by hand: inside a subquery drizzle renders a column bare, and a bare `id` would be the
      // subquery's own table's.
      propertyCount: sql<number>`(select count(*)::int from property p where p.tarla_id = "lookup_tarla"."id")`,
      cornerCount: sql<number>`(select count(*)::int from tarla_corner c where c.tarla_id = "lookup_tarla"."id")`,
    })
    .from(lookupTarla);
  const collator = new Intl.Collator("ro-RO", { numeric: true, sensitivity: "base" });
  return rows
    .map((r) => ({ ...r, propertyCount: Number(r.propertyCount), cornerCount: Number(r.cornerCount) }))
    .sort(
      (a, b) =>
        collator.compare(a.locality ?? "", b.locality ?? "") ||
        collator.compare(a.indicativ, b.indicativ) ||
        a.id.localeCompare(b.id),
    );
}

/** One tarla with its outline, or null. */
export async function getTarla(id: string): Promise<TarlaFull | null> {
  const [row] = await db.select().from(lookupTarla).where(eq(lookupTarla.id, id)).limit(1);
  if (!row) return null;
  const [{ n }] = await db.select({ n: count() }).from(property).where(eq(property.tarlaId, id));
  const corners = await db
    .select({ lat: tarlaCorner.lat, lon: tarlaCorner.lon, originalIndex: tarlaCorner.originalIndex })
    .from(tarlaCorner)
    .where(eq(tarlaCorner.tarlaId, id))
    .orderBy(asc(tarlaCorner.sequenceNo));
  return {
    id: row.id,
    indicativ: row.indicativ,
    locality: row.locality,
    county: row.county,
    descriere: row.descriere,
    notes: row.notes,
    origin: row.origin,
    propertyCount: Number(n),
    corners,
    updatedAt: row.updatedAt,
  };
}

/**
 * Save the page: the row through `writeTarlaRow` (a code taken in this locality throws `TarlaCodeTakenError`),
 * and, when `corners` is given, the outline replaced in the same transaction. Null when there is no such tarla.
 */
export async function updateTarla(id: string, input: TarlaUpdate): Promise<TarlaFull | null> {
  const found = await writeTarlaRow(input.indicativ, input.locality, id, async (tx) => {
    const [row] = await tx
      .update(lookupTarla)
      .set({
        indicativ: input.indicativ,
        ...(input.locality !== undefined ? { locality: input.locality } : {}),
        ...(input.county !== undefined ? { county: input.county } : {}),
        ...(input.descriere !== undefined ? { descriere: input.descriere } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(lookupTarla.id, id))
      .returning({ id: lookupTarla.id });
    if (!row) return false;
    if (input.corners !== undefined) {
      await tx.delete(tarlaCorner).where(eq(tarlaCorner.tarlaId, id));
      if (input.corners.length > 0) {
        await tx.insert(tarlaCorner).values(
          input.corners.map((c, i) => ({
            tarlaId: id,
            sequenceNo: i + 1,
            lat: c.lat,
            lon: c.lon,
            originalIndex: c.originalIndex ?? null,
          })),
        );
      }
    }
    return true;
  });
  return found ? getTarla(id) : null;
}

/** The properties on this tarla, by code. */
export async function listTarlaProperties(id: string): Promise<TarlaPropertyItem[]> {
  return db
    .select({
      id: property.id,
      code: property.code,
      nickname: property.nickname,
      parcela: property.parcela,
      typeName: lookupPropertyType.name,
      locality: propertyAddress.locality,
    })
    .from(property)
    .leftJoin(lookupPropertyType, eq(lookupPropertyType.id, property.propertyTypeId))
    .leftJoin(propertyAddress, eq(propertyAddress.propertyId, property.id))
    .where(eq(property.tarlaId, id))
    .orderBy(asc(property.code));
}

/**
 * The documents linked to this tarla's properties — a tarla has no documents of its own (it is not a principal
 * object), so „its documents" are its properties' — each once, with the properties it is linked through.
 */
export async function listTarlaDocuments(id: string): Promise<TarlaDocumentItem[]> {
  const props = await db.select({ id: property.id, code: property.code }).from(property).where(eq(property.tarlaId, id));
  if (props.length === 0) return [];
  const codeOf = new Map(props.map((p) => [p.id, p.code]));
  const rows = await db
    .select({
      id: document.id,
      code: document.code,
      title: document.title,
      typeName: lookupDocumentType.name,
      propertyId: propertyDocument.propertyId,
    })
    .from(propertyDocument)
    .innerJoin(document, eq(document.id, propertyDocument.documentId))
    .leftJoin(lookupDocumentType, eq(lookupDocumentType.id, document.documentTypeId))
    .where(inArray(propertyDocument.propertyId, props.map((p) => p.id)))
    .orderBy(asc(document.code));
  const byId = new Map<string, TarlaDocumentItem>();
  for (const r of rows) {
    const item = byId.get(r.id) ?? { id: r.id, code: r.code, title: r.title, typeName: r.typeName, propertyCodes: [] };
    const code = codeOf.get(r.propertyId);
    if (code && !item.propertyCodes.includes(code)) item.propertyCodes.push(code);
    byId.set(r.id, item);
  }
  return [...byId.values()];
}
