/**
 * DB query helpers for the Document API.
 *
 * Delete: the API path deletes the row (Slice #29.04). Pages, versions and
 * junctions cascade, the document's `principal_object` row goes with it (see
 * `src/lib/entities/delete.ts`), and the stored page FILES are removed too —
 * which nothing in this application had ever done before.
 *
 * NOTE (Slice #15.05): document types are no longer a hardcoded enum — they
 * are rows in `lookup_document_type`, managed via Administration → Reference
 * Data, referenced here via `documentTypeId` (a plain uuid FK). Per standing
 * rule: new type values are added by Adrian (or by Claude only when
 * explicitly directed) — never auto-seeded by application code.
 */

import { asc, and, count, desc, eq, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db, type DbTransaction } from "@/db";
import { appendVersionsIfChanged } from "@/lib/versioning/append";
import { DOCUMENT_SNAPSHOT_KEYS } from "@/lib/versioning/snapshot-registry";
import { document, documentVersion, entityMetadata, groupMember, groups, lookupDocumentType, person, principalObject } from "@/db/schema";
import { deletePrincipalObjects } from "@/lib/entities/delete";
import { listDocumentPageFilePaths } from "./pages-queries";
import { deleteFiles } from "@/lib/storage";
import type {
  DocumentCreate,
  DocumentListQuery,
  DocumentSnapshot,
  DocumentUpdate,
} from "./validation";
import { customFieldsEqual, parseTemplateFields, type DocumentTemplateField } from "./template-fields";
// Slice #34.10 — a pure module, and its own header says why it is not in
// this file: a suite for it here has to load `pg` to test a string.
import { customFieldFilter } from "./custom-field-filter";
// Slice #34.15 — the one place that answers „may this role be attached here".
// Pure, so the rule is testable without a connection; the offered set is read
// by the caller, because only the caller knows which whitelist governs it.
import { assertRoleMayBeAttached } from "@/lib/admin/value-lists/role-attachment";
import { DocumentNotFoundError } from "@/lib/documents/document-not-found";

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


export async function listDocument(
  opts: DocumentListQuery,
  expiringSoonDays = 30,
): Promise<{
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
    opts.documentTypeIds && opts.documentTypeIds.length > 0
      ? inArray(document.documentTypeId, opts.documentTypeIds)
      : undefined,
    groupFilter,
    // Slice #20.06: metadata filters.
    opts.importance ? eq(entityMetadata.importance, opts.importance) : undefined,
    opts.relevance  ? eq(entityMetadata.relevance,  opts.relevance)  : undefined,
    // Slice #20.06: expiring-soon shortcut.
    // expiringSoonDays is configurable via time_frame_setting (Slice #20.19).
    opts.expiringSoon
      ? (() => {
          const horizon = new Date();
          horizon.setDate(horizon.getDate() + expiringSoonDays);
          const horizonStr = horizon.toISOString().split("T")[0];
          return and(
            isNotNull(document.dateValidUntil),
            lte(document.dateValidUntil, horizonStr),
          );
        })()
      : undefined,
    pat
      ? or(
          ilike(document.code,       pat),
          ilike(document.title,      pat),
          ilike(document.nrDocument, pat),
        )
      : undefined,
    customFieldFilter(opts),
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
      // Slice #20.06: must join entityMetadata when importance/relevance/expiringSoon filter active.
      .leftJoin(entityMetadata, eq(entityMetadata.principalObjectId, document.principalObjectId))
      .where(where),
  ]);

  return { items: items as DocumentListItem[], total: totals[0]?.total ?? 0 };
}

/**
 * Which values does one custom field actually hold, and how often?
 *                                                              (Slice #34.10)
 *
 * ⚠️ **THIS EXISTS BECAUSE "MINIMISE HUMAN EFFORT" APPLIES TO FILTERS TOO.** A
 * free-text box beside a key would be a filter you can only use if you already
 * know, byte for byte, which of Adrian's five descriptions was typed onto the
 * documents — including the diacritics. The archive knows. Asking it turns
 * "filter, if you can guess" into "here are the flavours, pick one", which is
 * the grouping half of D-01 rather than a control that technically works.
 *
 * ⚠️ **The counts are returned and they are not decoration.** A flavour with
 * one document behind it is almost always a typo in a value somebody typed by
 * hand, and it is invisible in a bare list of strings. Beside a count it is the
 * first thing anyone notices.
 *
 * ⚠️ **`ORDER BY count DESC, value ASC` — frequency first, and a tie broken
 * deterministically.** Alphabetical alone buries the flavour that covers most
 * of the archive; frequency alone reorders the list on every import, so a user
 * who learned where an option sits finds it somewhere else next week. The tie
 * break is what stops rows shuffling between two runs that hold the same data.
 *
 * ⚠️ **Empty is not a value.** `NULL` and `''` are the two ways `custom_fields`
 * records "nothing captured" — the form blanks empty strings to `null` on save
 * but older rows hold both — and neither is a flavour anyone groups by. They
 * are excluded here rather than filtered out on the client, so the LIMIT counts
 * real options.
 *
 * ⚠️ **`LIMIT` at all, because this reads a column no index covers.** A key
 * somebody mistypes matches nothing and the query is a sequential scan either
 * way; what the cap bounds is the RESPONSE — a free-text field used as a
 * comment box would otherwise return one option per document.
 */
export async function listDocumentCustomFieldValues(
  opts: { key: string; documentTypeIds?: string[] },
  limit = 200,
): Promise<{ value: string; count: number }[]> {
  const key = opts.key.trim();
  if (!key) return [];
  // The same short-circuit `listDocument` makes, and for the same reason: an
  // explicitly empty type filter means "nothing is selected", and `IN ()` is a
  // syntax error rather than an empty result.
  if (opts.documentTypeIds !== undefined && opts.documentTypeIds.length === 0) return [];

  /**
   * ⚠️ **`GROUP BY 1` / `ORDER BY 2, 1` — SELECT-LIST ORDINALS, AND A DRIZZLE
   * TRAP IS WHY.** The obvious spelling builds the `->>` expression once as a
   * `const` and passes that same chunk to `select`, `where`, `groupBy` and
   * `orderBy`. It reads as one expression reused four times. It is not: drizzle
   * appends the bind parameter on EVERY emission, so the four renders carry
   * four different placeholders —
   *
   *     select "custom_fields" ->> $1::text, count(*) … group by … ->> $4::text
   *
   * — and Postgres compares a select-list expression against a GROUP BY item
   * with `equal()`, which compares `paramid`. `$1` and `$4` are not equal, the
   * whole-expression match fails, the walker descends to the bare
   * `document.custom_fields` and the statement is rejected:
   * `42803: column "document.custom_fields" must appear in the GROUP BY clause`.
   * `ORDER BY` fails the same way, independently.
   *
   * ⚠️ **And it would have failed SILENTLY on screen.** The route answers 500,
   * `valuesQuery` errors, `valueOptions` falls back to `[]`, and the value
   * dropdown renders enabled with one option and no error anywhere — a filter
   * that looks present and never works. An adversarial round rendered the SQL
   * and found this; nothing else could have, because `tsc` and ESLint see a
   * well-typed builder chain and the WHERE-clause suite is green either way.
   *
   * Ordinals sidestep the comparison entirely: there is no expression to match,
   * so the key is bound once in the select and once in the where, where being a
   * separate parameter costs nothing.
   */
  const rows = await db
    .select({
      value: sql<string>`${document.customFields} ->> ${key}::text`,
      count: count(),
    })
    .from(document)
    .where(
      and(
        opts.documentTypeIds && opts.documentTypeIds.length > 0
          ? inArray(document.documentTypeId, opts.documentTypeIds)
          : undefined,
        sql`${document.customFields} ->> ${key}::text IS NOT NULL`,
        sql`${document.customFields} ->> ${key}::text <> ''`,
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`, sql`1 asc`)
    .limit(limit);

  return rows.map((r) => ({ value: r.value, count: r.count }));
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
    .where(eq(document.id, id))
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

/**
 * Driven from the registry, like its three siblings.           (Slice #34.07)
 *
 * The slice found `SNAPSHOT_PROPERTY_KEYS` in `src/lib/properties/queries.ts`
 * holding nine keys where the compile-guarded registry array beside it held
 * ten — and the hand-written one was the array the comparison actually read,
 * so `calculatedAreaMp` was written into every snapshot and compared in none.
 * These four lists were the same shape with the same absence of a guard; they
 * happened to agree, which is a fact about today and not a property of the
 * code. Pointing them at the registry makes `AssertExactKeys` load-bearing
 * here too: a field added to the *Snapshot type now fails to compile until the
 * registry names it, and naming it there is what puts it here.
 *
 * No behaviour changes in this file: the array below is the same keys it was.
 */
// `customFields` is in the registry array and therefore in this one; it is
// compared specially in `snapshotsEqual` below (nested record, not a flat
// string), which is the branch that reads it.
const SNAPSHOT_KEYS: ReadonlyArray<keyof DocumentSnapshot> = DOCUMENT_SNAPSHOT_KEYS;

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
    // Slice #21.03.Import
    customFields:      full.customFields ?? null,
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
    .where(eq(document.id, id))
    .limit(1);

  const doc = rows[0] ?? null;
  if (!doc) return null;

  let surveyorDisplayName: string | null = null;
  let surveyorPersonType:  "NATURAL" | "JUDICIAL" | null = null;

  if (doc.surveyorId) {
    const pRows = await db
      .select({ displayName: person.displayName, type: person.type })
      .from(person)
      .where(eq(person.id, doc.surveyorId))
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
    // customFields is a nested record — `!==` would always be true (different
    // object identity) even when the contents match. Compare it separately.
    if (k === "customFields") {
      if (!customFieldsEqual(a.customFields, b.customFields)) return false;
      continue;
    }
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Append versions for these documents, where the snapshot really changed.
 *                                                              (Slice #29.14)
 *
 * The comparison `updateDocument` makes, callable by anything else that
 * rewrites documents inside a transaction — today the bulk re-point on the
 * Reference Data screen, which moves `document_type_id` and `institution_id`,
 * both of them inside the snapshot. Before #29.14 that move wrote no version
 * at all, so the type change surfaced in the NEXT ordinary edit's diff, under
 * whoever made that edit.
 *
 * ⚠️ **Set-shaped, and reading through `tx`.** Three statements for the whole
 * batch — the document read, the latest-version read, the insert — rather than
 * three per document; an adversarial round costed the per-object version at
 * 15 000 sequential round trips for a 5 000-document move, inside one
 * transaction holding two lookup rows locked. And through the global `db`
 * handle these reads would not see the caller transaction's uncommitted
 * writes, which is the Slice #18.05 trap.
 *
 * `prebuilt` is for the caller that has already built its snapshots.
 * Returns how many version rows were written.
 */
export async function recordDocumentVersionsIfChanged(
  tx: DbTransaction,
  ids: readonly string[],
  updatedBy: string | null,
  prebuilt?: ReadonlyMap<string, DocumentSnapshot>,
): Promise<number> {
  return appendVersionsIfChanged<DocumentSnapshot>(
    {
      buildSnapshots: async (batch) => {
        // Scoped to the batch rather than returned whole, and an adversarial
        // round is why: `appendVersionsIfChanged` cuts its own ids into
        // batches, and a caller that hands over a whole-set `prebuilt` with a
        // chunked `ids` would otherwise have every batch after the first
        // quietly write the FIRST batch's snapshots. Today's four callers pass
        // exactly one id, so this changes nothing for them and everything for
        // the next one.
        if (prebuilt) {
          return new Map(
            batch
              .filter((id) => prebuilt.has(id))
              .map((id) => [id, prebuilt.get(id)!] as const),
          );
        }
        const idList = [...batch];
        if (idList.length === 0) return new Map();
        const rows = await tx
          .select()
          .from(document)
          .where(inArray(document.id, idList));
        return new Map(rows.map((r) => [r.id, snapshotFromFull(r)]));
      },
      latestVersions: async (batch) => {
        const idList = [...batch];
        if (idList.length === 0) return new Map();
        // DISTINCT ON + the matching ORDER BY is "the newest row per document"
        // in one query. The ORDER BY is not cosmetic: DISTINCT ON keeps the
        // FIRST row of each group, so dropping `desc(versionNumber)` would
        // silently compare against version 0 forever.
        const rows = await tx
          .selectDistinctOn([documentVersion.documentId], {
            documentId:    documentVersion.documentId,
            versionNumber: documentVersion.versionNumber,
            snapshot:      documentVersion.snapshot,
          })
          .from(documentVersion)
          .where(inArray(documentVersion.documentId, idList))
          .orderBy(documentVersion.documentId, desc(documentVersion.versionNumber));
        return new Map(
          rows.map((r) => [
            r.documentId,
            {
              versionNumber: r.versionNumber,
              snapshot: r.snapshot as DocumentSnapshot,
            },
          ]),
        );
      },
      equal: snapshotsEqual,
      insertVersions: async (rows, by) => {
        await tx.insert(documentVersion).values(
          rows.map((r) => ({
            documentId:    r.id,
            versionNumber: r.versionNumber,
            snapshot:      r.snapshot,
            updatedBy:     by,
          })),
        );
      },
    },
    ids,
    updatedBy,
  );
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
      .where(eq(document.id, id))
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

    if (input.notes !== undefined) patch.notes = input.notes ?? null;

    // Slice #19.03
    if (input.subject        !== undefined) patch.subject        = input.subject        ?? null;
    if (input.dateValidUntil !== undefined) patch.dateValidUntil = input.dateValidUntil ?? null;
    if (input.surveyorId     !== undefined) patch.surveyorId     = input.surveyorId     ?? null;

    // Slice #21.03.Import
    if (input.customFields !== undefined) patch.customFields = input.customFields ?? null;

    // Slice #21.02.Import: operational field — NOT included in version snapshot.
    if (input.aiInterpretedAt !== undefined) {
      patch.aiInterpretedAt = input.aiInterpretedAt
        ? new Date(input.aiInterpretedAt)
        : null;
    }

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
    // Slice #29.14 moved the comparison itself into
    // `recordDocumentVersionsIfChanged` so the bulk re-point makes the same one
    // rather than a second copy of it. The snapshot is handed over rather than
    // rebuilt, because this path has already paid for the re-fetch above.
    await recordDocumentVersionsIfChanged(
      tx,
      [id],
      updatedBy,
      new Map([[id, snapshotFromFull(updated)]]),
    );

    return updated;
  });
}

/**
 * Which of these document ids still exist?   (Slice #29.11)
 *
 * ⚠️ **THE POSITIVE ANSWER, NOT THE NEGATIVE ONE, AND THAT IS DELIBERATE.** The
 * caller wants to know which rows of a saved import report have gone; deriving
 * that from what came back means an empty result is read as "all of them are
 * gone", which is true. Returning the MISSING ids from here instead would put
 * that subtraction on the server, where a query that matched nothing because it
 * was malformed and a query that matched nothing because the rows are gone
 * would produce the same confident list of casualties.
 *
 * ⚠️ **EVERY ID MUST BE UUID-SHAPED, and an adversarial round made this say
 * so.** The comment here used to read "ids are not required to be real:
 * anything that matches nothing is simply absent from the result" — true of a
 * well-formed uuid that has since been deleted, and false of a string that is
 * not one. `document.id` is a `uuid` column, so `inArray` binds the values into
 * a comparison Postgres resolves at type `uuid`, and a value like `"DOC00123"`
 * raises `22P02 invalid input syntax for type uuid`: the WHOLE call rejects, and
 * every good id in the batch is lost with it. That is the all-or-nothing
 * failure `POST /api/documents/exists` filters ahead of this call to prevent,
 * and a caller who believed the old sentence would walk straight into it.
 *
 * A well-formed uuid that matches nothing IS simply absent, exactly as
 * `deleteDocuments` treats a stale id.
 *
 * Read-only. No transaction, no join, one index lookup.
 */
export async function existingDocumentIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select({ id: document.id })
    .from(document)
    .where(inArray(document.id, ids));

  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
//
// Slice #29.04. Adrian's sentence is "whatever I see on the screen it is what
// is in reality in database and in the files", and until this function the
// second half had never been implemented at all: `deleteFile` existed and had
// exactly one caller in the whole application (the route that removes a
// single page), so every scan of every document ever deleted was still
// sitting in the bucket.
//
// ORDER: read the file keys and delete the rows in one transaction, then
// delete the bytes. Three reasons it is that way round and not files-first.
//
//   1. The database half is atomic and the storage half cannot be. Putting
//      the non-atomic step last means the all-or-nothing decision is taken
//      once, and a storage failure arrives after it rather than during it.
//   2. If storage fails afterwards what is left is bytes nothing references —
//      invisible, harmless, and sweepable. If storage went FIRST and the
//      transaction then rolled back, the document would still be listed,
//      still open, and every page would 404. That is the visible lie this
//      slice exists to remove, and it is strictly worse.
//   3. `document_page.file_path` is the only record of where the bytes are,
//      and the rows cascade — so the keys have to be read BEFORE the delete
//      whichever order the two halves run in.
//
// A storage failure is therefore logged, not raised: the caller has already
// succeeded, and answering 500 would send the user back to retry a delete
// that would now 404. The log line is the only artefact a later sweep has.

export async function deleteDocuments(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { deleted, filePaths } = await db.transaction(async (tx) => {
    // Inside the transaction, and before the delete: document_page cascades,
    // so after the DELETE nothing knows where the bytes are, and outside the
    // transaction a page uploaded in the gap would be orphaned with its key
    // recorded nowhere at all.
    const paths = await listDocumentPageFilePaths(ids, tx);

    const rows = await tx
      .delete(document)
      .where(inArray(document.id, ids))
      .returning({ principalObjectId: document.principalObjectId });

    await deletePrincipalObjects(tx, rows.map((r) => r.principalObjectId));
    return { deleted: rows.length, filePaths: paths };
  });

  if (deleted > 0 && filePaths.length > 0) {
    const failed = await deleteFiles(filePaths);
    if (failed.length > 0) {
      console.error(
        `[deleteDocuments] ${failed.length} page file(s) could not be removed from storage and are now orphaned: ${failed.join(", ")}`,
      );
    }
  }

  return deleted;
}

/** Single-document delete. Returns false when the id matched nothing (→ 404). */
export async function deleteDocument(id: string): Promise<boolean> {
  return (await deleteDocuments([id])) > 0;
}

// ---------------------------------------------------------------------------
// Internal helper — maps validated input to DB insert values
// ---------------------------------------------------------------------------

function inputToValues(
  input: DocumentCreate,
): Omit<typeof document.$inferInsert, "id" | "code" | "principalObjectId" | "createdAt" | "updatedAt"> {
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

    notes: input.notes ?? null,

    // Slice #19.03
    subject:        input.subject        ?? null,
    dateValidUntil: input.dateValidUntil ?? null,
    surveyorId:     input.surveyorId     ?? null,

    // Slice #21.03.Import
    customFields: input.customFields ?? null,

    // Slice #32.06 — the title the FOLDER gave this document, which the AI
    // read never touches. `snapshotFromFull` omits it on purpose: it is not a
    // versioned form field, it is provenance, exactly like `aiInterpretedAt`.
    importTitle: input.importTitle ?? null,
  };
}

// ---------------------------------------------------------------------------
// Document type template  (Slice #21.03.Import)
// ---------------------------------------------------------------------------

export type DocumentTypeTemplate = {
  key:    string;
  name:   string;
  fields: DocumentTemplateField[];
};

/**
 * The document type's key/name + its parsed template fields (or an empty
 * `fields` array when the type has no template yet). Used both by the
 * document form (to render the type-specific section) and by the AI-Interpret
 * route (to build a per-type extraction prompt).
 */
export async function getDocumentTypeTemplate(
  documentTypeId: string,
): Promise<DocumentTypeTemplate | null> {
  const [row] = await db
    .select({
      key:            lookupDocumentType.key,
      name:           lookupDocumentType.name,
      templateFields: lookupDocumentType.templateFields,
    })
    .from(lookupDocumentType)
    .where(eq(lookupDocumentType.id, documentTypeId))
    .limit(1);

  if (!row) return null;
  return { key: row.key, name: row.name, fields: parseTemplateFields(row.templateFields) };
}

/**
 * The same row, plus the id and the raw template — for the save path.
 *
 * Separate from getDocumentTypeTemplate above because the two want different
 * things. That one is a read for a prompt or a form; this one backs a WRITE
 * and returns the id the caller echoes back. Since Slice #29.04 a deleted
 * type simply has no row, so the guard both queries used to need is the
 * `eq(id)` itself — a write against a type that was deleted between the read
 * and the write matches nothing and the route answers 404.
 */
export async function getDocumentTypeForTemplateEdit(
  documentTypeId: string,
): Promise<{ id: string; key: string; name: string; fields: DocumentTemplateField[] } | null> {
  const [row] = await db
    .select({
      id:             lookupDocumentType.id,
      key:            lookupDocumentType.key,
      name:           lookupDocumentType.name,
      templateFields: lookupDocumentType.templateFields,
    })
    .from(lookupDocumentType)
    .where(eq(lookupDocumentType.id, documentTypeId))
    .limit(1);

  if (!row) return null;
  return {
    id:     row.id,
    key:    row.key,
    name:   row.name,
    fields: parseTemplateFields(row.templateFields),
  };
}

/**
 * Replace a document type's custom form.   (Slice #26.11)
 *
 * Writes ONLY `template_fields` (plus `updated_at`) — deliberately not the
 * full-row `set(data)` the generic value-lists update does. That one is a
 * full-replace PUT whose schema requires `name` and defaults `sortOrder` to 0,
 * so routing this write through it would need the caller to resend both, and a
 * caller that forgot `sortOrder` would silently re-sort the admin list as a
 * side effect of saving a form.
 *
 * Returns null when the id matches nothing live, so the route can 404 rather
 * than report a save that wrote no row.
 */
export async function setDocumentTypeTemplateFields(
  documentTypeId: string,
  fields: DocumentTemplateField[],
): Promise<{ id: string; key: string; name: string; fields: DocumentTemplateField[] } | null> {
  const [row] = await db
    .update(lookupDocumentType)
    .set({ templateFields: fields, updatedAt: new Date() })
    .where(eq(lookupDocumentType.id, documentTypeId))
    .returning({
      id:             lookupDocumentType.id,
      key:            lookupDocumentType.key,
      name:           lookupDocumentType.name,
      templateFields: lookupDocumentType.templateFields,
    });

  if (!row) return null;
  return {
    id:     row.id,
    key:    row.key,
    name:   row.name,
    fields: parseTemplateFields(row.templateFields),
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
  lookupDocumentDocumentRole,
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

  const where = pat
      ? or(ilike(document.code, pat), ilike(document.title, pat))
      : undefined;

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
    .innerJoin(property, eq(propertyDocument.propertyId, property.id))
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

export type PersonDocumentQuality = "DEFUNCT" | "MOSTENITOR";

export type DocumentPersonItem = {
  id:           string;
  code:         string;
  type:         "NATURAL" | "JUDICIAL";
  displayName:  string;
  quality:      PersonDocumentQuality | null;
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
    .innerJoin(person, eq(personDocument.personId, person.id))
    .leftJoin(lookupPersonRole, eq(personDocument.personRoleId, lookupPersonRole.id))
    .where(eq(personDocument.documentId, documentId))
    .orderBy(person.displayName);

  return rows as DocumentPersonItem[];
}

/**
 * ⚠️ **THE ROLE IS CHECKED HERE RATHER THAN IN THE ROUTE.**    (Slice #34.15)
 *
 * Five routes accept a `personRoleId` and this is one of the two functions
 * behind them that writes `person_document`; putting the check in the routes
 * would be five copies of one rule guarding four tables, and a sixth route
 * added later would simply not have it. `assertRoleMayBeAttached` throws
 * `RoleNotOfferedError`, which every one of those routes turns into a 400 via
 * `roleNotOfferedToResponse`.
 *
 * The offered set is `listPersonRolesForDocument` — the same function
 * `/api/documents/[id]/valid-person-roles` serves to this document's own
 * picker, in this same module, so the door and the dropdown cannot drift.
 */
export async function associatePersonsToDocument(
  documentId:   string,
  personIds:    string[],
  quality?:     PersonDocumentQuality | null,
  personRoleId: string | null = null,
): Promise<void> {
  /*
   * ⚠️ **THE DOCUMENT IS CHECKED BEFORE THE ROLE, AND THE ORDER IS THE WHOLE
   * FIX.**                                                     (Slice #34.26)
   *
   * The door's offered set is `listPersonRolesForDocument(documentId)`, and
   * that function answers `[]` for a document that does not exist — deliberately,
   * for the reasons its own header gives. An empty offered set refuses every
   * non-null role, correctly, so a POST naming a document that is gone came
   * back `ROLE_NOT_OFFERED` and the screen told the user in Romanian that their
   * ROLE had been withdrawn. Two true statements composing into a false one;
   * #34.15's handover recorded it the day the door went in.
   *
   * ⚠️ **HERE RATHER THAN IN `listPersonRolesForDocument`.** That function is
   * also what `/api/documents/[id]/valid-person-roles` serves, whose job is to
   * answer a LIST; teaching it to throw would turn a document deleted in
   * another session into a 500 on a read, which its header refuses in as many
   * words. The write is the caller that needs the difference, so the write is
   * where it is asked.
   *
   * ⚠️ **AND BEFORE THE ROLE RATHER THAN AFTER, SO A ROLE-LESS POST IS ANSWERED
   * THE SAME WAY.** With no role the door reads nothing and the insert used to
   * fail on the foreign key, which this route turns into a 500 —
   * „Internal server error" for a request that is simply naming something that
   * is not there. One check before both covers both, and the second read of the
   * same row on the role path is one SELECT on a write.
   *
   * ⚠️ **IT DOES NOT CHECK THE PEOPLE.** `personIds` is still left to the
   * foreign key: the route's entity is the DOCUMENT, it is the one the path
   * names, and the one #34.15's note is about. Widening this to every id in the
   * body is a different decision about a different failure and is in the
   * handover, not here.
   */
  const [documentRow] = await db
    .select({ id: document.id })
    .from(document)
    .where(eq(document.id, documentId))
    .limit(1);
  if (!documentRow) throw new DocumentNotFoundError(documentId);

  await assertRoleMayBeAttached("document-person", personRoleId, async () =>
    (await listPersonRolesForDocument(documentId)).map((r) => r.id),
  );
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

/**
 * „Which person roles may appear on this document?" — ONE ANSWER, WHOEVER
 * ASKS.                                     (Decision D-16(b), Slice #34.16)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   This function and `listPersonRolesForDocumentType` below answered the same
 *   question two different ways, forty lines apart. This one read the roles
 *   ticked for the document's type and, when that returned nothing, fell back
 *   to „every role ticked for SOME document type"; that one had no fallback and
 *   answered the empty list. So on an unconfigured type the manual picker
 *   offered every role in the archive and the machine path refused to extract
 *   at all — one table, one question, two answers, and the wider of them was
 *   built out of roles nobody had ever ticked for this kind of document.
 *
 * ⚠️ **THE FALLBACK IS GONE, AND THE SENTENCE ON THE SCREEN IS WHAT PAYS FOR
 * IT.** Removing it empties the picker on every type that has no rows in
 * `lookup_doc_type_person_role`, and an empty select with nothing said is worse
 * than a wide one — which is why this could not be done alone.
 * `components/forms/no-roles-for-type-note.tsx` prints `shared.noRolesForType`
 * — the type has no roles configured, „Roluri pe Document" is where that is
 * fixed, and the association can still be made without a role — and points at
 * the grid where Slice #34.10 put it. The empty select is not the change; the
 * empty select PLUS the sentence is.
 *
 * ⚠️ **ON THREE SCREENS, NOT ONE, AND THE OTHER TWO ARE EASY TO MISS.** The
 * document's own „Asociază persoană" is the screen the decision was written
 * about, but both person-side „Asociază document" screens read
 * `/api/documents/[id]/valid-person-roles` whenever exactly one document is
 * ticked, so this function empties their select too. An adversarial round found
 * them; anything that changes what this returns has three screens to check, and
 * `carried-role-options.test.ts` §3b enumerates them.
 *
 * ⚠️ **THE SENTENCE IS GATED ON „THE LIST WAS READ AND IS EMPTY", NEVER ON
 * „THIS RETURNED NOTHING".** During load and after a failed read the callers
 * also have nothing, and those are different facts with different sentences —
 * `shared.roleListUnavailable` owns the failure. `lookupListState` is the one
 * definition of „loaded" and all three screens gate on it, so the two notes
 * cannot both print.
 *
 * ⚠️ **AND IT ONLY COSTS THE CHOICE ON A NEW ASSOCIATION, WHICH IS WHY THE
 * DECISION COULD BE TAKEN NOW AND NOT BEFORE.** Since Slice #34.05 the picker
 * unions this offer with the roles THIS DOCUMENT's own rows already carry,
 * marked „(nu mai este disponibil)" (`carried-roles.ts`,
 * `carried-roles-merge.ts`). So a row that already holds a role still renders
 * it; what an empty answer removes is the ability to pick a role for a row that
 * does not exist yet. Before #34.05 those were the same thing, and taking this
 * decision then would have blanked rows that read correctly.
 *
 * ⚠️ **DELEGATION RATHER THAN THE SAME QUERY TWICE, AND THAT IS THE WHOLE
 * POINT.** With the fallback gone the two functions answer identically, and two
 * bodies that agree today are two bodies that can disagree tomorrow — the
 * second copy of a whitelist is exactly the divergence #34.05 was written to
 * remove (`role-offers.ts` refuses to hold a third copy for the same reason).
 * Written this way the manual picker, the write door
 * (`associatePersonsToDocument`) and AI party extraction cannot drift: they are
 * the same function, reached by two names because the callers hold two
 * different keys — a document id here, a document type id there.
 *
 * ⚠️ **A DOCUMENT THAT DOES NOT EXIST RETURNS `[]`, WHICH IS NOT THE SAME
 * EMPTY.** It is the one answer this function gives that is not about
 * configuration at all. Left as `[]` rather than a throw because every caller
 * already treats „no roles" as „offer nothing", and a throw here would turn a
 * deleted document into a 500 on a route that is meant to answer a list.
 *
 * The residual, stated rather than left to be rediscovered: a document deleted
 * in another session makes a screen print „this type has no roles configured"
 * about a document that no longer exists. On the document's own „Asociază
 * persoană" that needs the deletion to land after `page.tsx` has already found
 * the row, because it 404s at mount. **On the two person-side „Asociază
 * document" screens there is no such bound** — the route's entity is a PERSON,
 * and the document id comes from a search result the user ticks, which nothing
 * revalidates. An adversarial round is what found that the bound covered one
 * screen out of three. It is left as `[]` all the same: the alternative is a
 * second shape in this return type plus a 404 branch on a route whose job is to
 * answer a list.
 *
 * ⚠️ **AND THE „IT ONLY COSTS A MOMENT OF CONFUSION" HALF OF THAT ARGUMENT NOW
 * HAS TO NAME ITS CALLER — Slice #34.26.** It used to read „the write that
 * follows fails on the foreign key, so the wrong sentence is a moment of
 * confusion rather than a wrong row", which was true of both writes. It is now
 * true only of `associateDocumentsToPerson` (the person-side POST, which never
 * looks the document up). `associatePersonsToDocument` looks it up itself and
 * throws `DocumentNotFoundError` before the door, so on THAT path the write no
 * longer reaches the foreign key and answers 404. Two callers, two endings,
 * both correct, and the difference is worth a sentence because this function's
 * `[]` is what makes the second one necessary.
 *
 * ⚠️ **#34.26 EXTENDED THAT RESIDUAL TO A SECOND SENTENCE, WHICH IS RECORDED
 * HERE RATHER THAN ONLY ON THE SCREEN.** The person-side screens now also read
 * this function once per TICKED document, to name the ones whose type will not
 * offer a chosen role again. A deleted document answers `[]` here and is
 * therefore named by that sentence too, for a reason that is not its type.
 */
export async function listPersonRolesForDocument(documentId: string): Promise<RoleItem[]> {
  const [doc] = await db
    .select({ documentTypeId: document.documentTypeId })
    .from(document)
    .where(eq(document.id, documentId))
    .limit(1);

  if (!doc) return [];

  return listPersonRolesForDocumentType(doc.documentTypeId);
}

/**
 * The roles ticked for one document type — the whole answer, with no fallback.
 *
 * Slice #21.04.Import gave this function its no-fallback rule for AI party
 * extraction: a model must not be asked to match a party against a pool of
 * roles nobody ticked for this kind of document, so when this returns nothing
 * the caller skips party extraction entirely and tells the admin to configure
 * the type first (`partyRolesConfigured: false` in
 * `api/documents/[id]/ai-interpret/route.ts`).
 *
 * ⚠️ **SINCE SLICE #34.16 THAT RULE IS THE ONLY RULE, AND THE TWO FUNCTIONS
 * ARE DELIBERATELY THE SAME RATHER THAN MERELY DIFFERENT.**
 * `listPersonRolesForDocument` above now delegates here instead of widening the
 * answer for the manual picker; its header carries the argument. What used to
 * be „the machine is strict and the human is not" is now one answer that both
 * paths read, and the difference between them is what they DO with an empty
 * one: extraction does not run, the picker shows a sentence saying the type has
 * no roles configured. Any future slice that gives either function a fallback
 * of its own is re-opening D-16(b), and `role-attachment-door.test.ts` §4 is
 * where that gets noticed.
 *
 * ⚠️ **„Reference Data → Document Persons" IS NO LONGER WHERE THIS SENDS
 * PEOPLE, AND THIS HEADER SAID IT UNTIL #34.16.** Slice #34.10 moved the grid
 * onto the document-type screen and removed its hub button: it is now
 * „Date de referință → Tipuri de Document → Roluri pe Document", the toolbar
 * button beside „+ Adaugă" on that list. Every sentence this archive shows a
 * user about configuring these roles points there.
 */
export async function listPersonRolesForDocumentType(documentTypeId: string): Promise<RoleItem[]> {
  return db
    .select({
      id:   lookupPersonRole.id,
      name: lookupPersonRole.name,
    })
    .from(lookupDocTypePersonRole)
    .innerJoin(lookupPersonRole, eq(lookupDocTypePersonRole.personRoleId, lookupPersonRole.id))
    .where(eq(lookupDocTypePersonRole.documentTypeId, documentTypeId))
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
  id:                   string;
  code:                 string;
  documentTypeId:       string;
  typeName:             string | null;
  title:                string | null;
  associatedAt:         Date;
  relationshipRoleId:   string | null;
  relationshipRoleName: string | null;
};

export async function listDocumentReferences(documentId: string): Promise<DocumentRefItem[]> {
  const rows = await db
    .select({
      documentIdA:          documentDocument.documentIdA,
      documentIdB:          documentDocument.documentIdB,
      associatedAt:         documentDocument.createdAt,
      relationshipRoleId:   documentDocument.relationshipRoleId,
      relationshipRoleName: lookupDocumentDocumentRole.name,
      id:                   document.id,
      code:                 document.code,
      documentTypeId:       document.documentTypeId,
      typeName:             lookupDocumentType.name,
      title:                document.title,
    })
    .from(documentDocument)
    .innerJoin(
      document,
      or(
          and(eq(documentDocument.documentIdA, documentId), eq(document.id, documentDocument.documentIdB)),
          and(eq(documentDocument.documentIdB, documentId), eq(document.id, documentDocument.documentIdA)),
        ),
    )
    .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .leftJoin(lookupDocumentDocumentRole, eq(documentDocument.relationshipRoleId, lookupDocumentDocumentRole.id))
    .where(or(eq(documentDocument.documentIdA, documentId), eq(documentDocument.documentIdB, documentId)))
    .orderBy(document.code);

  return rows.map((r) => ({
    id:                   r.id,
    code:                 r.code,
    documentTypeId:       r.documentTypeId,
    typeName:             r.typeName,
    title:                r.title,
    associatedAt:         r.associatedAt,
    relationshipRoleId:   r.relationshipRoleId ?? null,
    relationshipRoleName: r.relationshipRoleName ?? null,
  }));
}

export async function associateDocumentToDocument(
  documentId:         string,
  otherIds:           string[],
  relationshipRoleId: string | null = null,
): Promise<void> {
  const values = otherIds
    .filter((id) => id !== documentId)
    .map((otherId) => {
      const [a, b] = [documentId, otherId].sort();
      return {
        documentIdA:         a,
        documentIdB:         b,
        relationshipRoleId:  relationshipRoleId ?? undefined,
      };
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
