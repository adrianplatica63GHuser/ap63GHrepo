/**
 * A confirmed plan parcelar, written: its tarla found or created, its parcels kept, the plan linked.   (Slice #39.69)
 *
 * The import's tarla step calls this once the user has pressed „Creează" or „Leagă" on what the plan read
 * (src/lib/tarla/plan-read.ts). Nothing reaches here unconfirmed (D-12).
 *
 *   - The tarla: `resolveTarlaForCreate` — the import's own find-or-mint, under the same two locks and with the same
 *     IMPORT origin, written there and only there, looked for in the plan's locality (#39.67). So „link" and „create" cannot race into
 *     two rows, and a tarla someone added by hand meanwhile is adopted, not duplicated.
 *   - The parcels: added when the tarla does not have that number yet (folded, as the unique index folds it);
 *     a parcel already recorded keeps what it has — a second plan of the same tarla adds, it never overwrites.
 *   - The link: `document_tarla`, once.
 *
 * One transaction: a plan is linked to a tarla with its parcels, or nothing is written.
 */
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { document, documentTarla, lookupDocumentType, lookupTarla, lookupUseCategory, tarlaParcel } from "@/db/schema";
import { resolveTarlaForCreate } from "@/lib/properties/queries";
import { matchUseCategory, type TarlaPlanParcel } from "./plan-read";
import type { TarlaParcelItem, TarlaPlanItem } from "./types";

export type { TarlaParcelItem, TarlaPlanItem } from "./types";

export type TarlaPlanApply = {
  documentId: string;
  indicativ: string;
  locality: string | null;
  county: string | null;
  parcels: TarlaPlanParcel[];
};

export type TarlaPlanApplied = {
  tarlaId: string;
  created: boolean;
  parcelsAdded: number;
  parcelsKept: number;
};

export class TarlaPlanDocumentMissing extends Error {
  constructor() {
    super("document_not_found");
  }
}

export async function applyTarlaPlan(input: TarlaPlanApply): Promise<TarlaPlanApplied> {
  const categories = await db.select({ id: lookupUseCategory.id, name: lookupUseCategory.name }).from(lookupUseCategory);
  return db.transaction(async (tx) => {
    const [doc] = await tx.select({ id: document.id }).from(document).where(eq(document.id, input.documentId)).limit(1);
    if (!doc) throw new TarlaPlanDocumentMissing();

    const tarlaId = await resolveTarlaForCreate(tx, { tarlaCode: input.indicativ, tarlaLocality: input.locality });
    if (!tarlaId) throw new Error("tarla_code_empty");
    // Created by this transaction? `now()` is the transaction's start in Postgres, and a row inserted in it carries
    // exactly that as its default `created_at` — so the comparison is exact, and needs no second copy of the scan.
    const [row] = await tx
      .select({ created: sql<boolean>`${lookupTarla.createdAt} = now()` })
      .from(lookupTarla)
      .where(eq(lookupTarla.id, tarlaId));
    const found = { id: tarlaId, created: row?.created === true };
    // A tarla the plan created takes the county the plan printed; one that existed keeps its own.
    if (found.created && input.county) {
      await tx.update(lookupTarla).set({ county: input.county, updatedAt: new Date() }).where(eq(lookupTarla.id, found.id));
    }

    let parcelsAdded = 0;
    for (const p of input.parcels) {
      const useCategoryId = matchUseCategory(p.use, categories);
      const added = await tx
        .insert(tarlaParcel)
        .values({
          tarlaId: found.id,
          parcela: p.parcela,
          areaSqm: p.areaSqm === null ? null : String(p.areaSqm),
          useCategoryId,
          usePrinted: useCategoryId === null ? p.use : null,
          sourceDocumentId: input.documentId,
        })
        .onConflictDoNothing()
        .returning({ id: tarlaParcel.id });
      parcelsAdded += added.length;
    }

    await tx.insert(documentTarla).values({ documentId: input.documentId, tarlaId: found.id }).onConflictDoNothing();

    return {
      tarlaId: found.id,
      created: found.created,
      parcelsAdded,
      parcelsKept: input.parcels.length - parcelsAdded,
    };
  });
}

/** A tarla's parcels, in their natural order (2 before 10), each with its use and the plan it came from. */
export async function listTarlaParcels(tarlaId: string): Promise<TarlaParcelItem[]> {
  const rows = await db
    .select({
      id: tarlaParcel.id,
      parcela: tarlaParcel.parcela,
      areaSqm: tarlaParcel.areaSqm,
      useName: lookupUseCategory.name,
      usePrinted: tarlaParcel.usePrinted,
      sourceDocumentId: tarlaParcel.sourceDocumentId,
      sourceDocumentCode: document.code,
    })
    .from(tarlaParcel)
    .leftJoin(lookupUseCategory, eq(lookupUseCategory.id, tarlaParcel.useCategoryId))
    .leftJoin(document, eq(document.id, tarlaParcel.sourceDocumentId))
    .where(eq(tarlaParcel.tarlaId, tarlaId));
  const collator = new Intl.Collator("ro-RO", { numeric: true, sensitivity: "base" });
  return rows
    .map((r) => ({
      id: r.id,
      parcela: r.parcela,
      areaSqm: r.areaSqm === null ? null : Number(r.areaSqm),
      use: r.useName ?? r.usePrinted,
      sourceDocumentId: r.sourceDocumentId,
      sourceDocumentCode: r.sourceDocumentCode,
    }))
    .sort((a, b) => collator.compare(a.parcela, b.parcela) || a.id.localeCompare(b.id));
}

/** The documents linked to a tarla as its plans, by code. */
export async function listTarlaPlans(tarlaId: string): Promise<TarlaPlanItem[]> {
  return db
    .select({ id: document.id, code: document.code, title: document.title, typeName: lookupDocumentType.name })
    .from(documentTarla)
    .innerJoin(document, eq(document.id, documentTarla.documentId))
    .leftJoin(lookupDocumentType, eq(lookupDocumentType.id, document.documentTypeId))
    .where(eq(documentTarla.tarlaId, tarlaId))
    .orderBy(asc(document.code));
}

/** Is this document a plan parcelar? The read route refuses any other, so no paid read is spent by mistake. */
export async function documentTypeKey(documentId: string): Promise<string | null | undefined> {
  const [row] = await db
    .select({ key: lookupDocumentType.key })
    .from(document)
    .leftJoin(lookupDocumentType, eq(lookupDocumentType.id, document.documentTypeId))
    .where(eq(document.id, documentId))
    .limit(1);
  return row === undefined ? undefined : row.key;
}
