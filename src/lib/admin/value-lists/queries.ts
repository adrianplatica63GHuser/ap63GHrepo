/**
 * DB query helpers for the admin value-list tables.
 *
 * Slice #29.04: all deletes are real deletes. The row goes, its key is free
 * for immediate reuse, and nothing is left for a list query to filter.
 *
 * Slice #29.05: a delete is refused while anything depends on the row — for
 * all nine lists, in application code, because the schema refuses on one edge
 * of the fourteen that reach them. Of the rest, nine are ON DELETE SET NULL
 * (the association keeps its row and loses the label) and four cascade
 * whitelist rows away.
 * What the user is told, and the offer to move the dependents onto another
 * value first, are in `./dependents.ts`, `buildReport` and the dialog.
 *
 * Create and update still dispatch on the ListKey string via a switch —
 * verbose but fully type-safe within each case. The delete no longer does:
 * it reads its table from the same map the count and the move read.
 *
 * lookup_others was dropped in migration_052. ("groups" moved to its own
 * feature in Slice #18.07 — see src/lib/groups/.)
 */

import { and, asc, count, eq, getTableName, like, ne, sql } from "drizzle-orm";
import { nextFreeKey, slugifyLookupKey } from "./keys";
import { db, type DbTransaction } from "@/db";
import {
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  lookupPersonType,
  lookupPersonRole,
  lookupCitizenship,
  lookupJudicialPersonType,
  lookupDocumentType,
  lookupInstitution,
} from "@/db/schema";
import type { ListKey } from "./config";
import {
  LIST_DEPENDENCIES,
  dependentNotes,
  matchesByValue,
  type DependentCount,
  type DependentRef,
  type DependentsReport,
  type ListDependencies,
} from "./dependents";
import {
  sanitizeDocumentTypeTemplateFields,
  stripDocumentTypeOrigin,
} from "./validation";
import {
  isDocumentTypeOrigin,
  type DocumentTypeOrigin,
} from "@/lib/documents/status";

// Row types — inferred from the Drizzle table definitions.
export type LookupRow = Record<string, unknown> & { id: string };

/**
 * `nextFreeKey` against the live table, in ONE round trip.
 *
 * Reads every key that could possibly collide — anything starting with the
 * base — and lets `nextFreeKey` (src/lib/admin/value-lists/keys.ts) decide. One query rather than one
 * per candidate, and, more to the point, ONE implementation of the rule: a
 * loop here as well would be a second place that decides what a free key is,
 * and the two would eventually disagree.
 *
 * `_` is a single-character wildcard to LIKE and the slug is full of them, so
 * this pattern over-matches (`ZZZ_PROBA%` also finds `ZZZAPROBA`). That is
 * harmless by construction: the set holds real keys and `has()` is exact, so
 * an extra row can only be a key that was never a candidate. Over-fetching a
 * handful of lookup rows is the cheap direction; UNDER-fetching would hand
 * back a taken key and fail on INSERT with 23505.
 */
async function generateUniqueKey(
  table: typeof lookupDocumentType | typeof lookupPropertyType,
  name: string,
): Promise<string> {
  const base = slugifyLookupKey(name);
  const rows = await db
    .select({ key: table.key })
    .from(table)
    .where(like(table.key, `${base}%`));
  const taken = new Set(rows.map((r) => r.key));
  return nextFreeKey(base, (k) => taken.has(k));
}

async function generateUniqueDocumentTypeKey(name: string): Promise<string> {
  return generateUniqueKey(lookupDocumentType, name);
}

// Same slug logic for property types (Slice #19.02).
async function generateUniquePropertyTypeKey(name: string): Promise<string> {
  return generateUniqueKey(lookupPropertyType, name);
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listValues(key: ListKey): Promise<LookupRow[]> {
  switch (key) {
    case "property-types":
      // Slice #29.05: the `usageCount` correlated subquery that used to hang
      // off this branch is gone. It counted ONE class of dependent, for ONE of
      // the nine lists, at LIST-LOAD time — so it was stale by the time the
      // confirmation dialog read it, and it had no answer at all for the other
      // eight lists. The count is now live and generic: see `countDependents`
      // below, called by GET .../[id]/dependents when the dialog opens.
      return db.select().from(lookupPropertyType)
        .orderBy(asc(lookupPropertyType.sortOrder)) as Promise<LookupRow[]>;
    case "tarla":
      return db.select().from(lookupTarla)
        .orderBy(asc(lookupTarla.sortOrder)) as Promise<LookupRow[]>;
    case "use-categories":
      return db.select().from(lookupUseCategory)
        .orderBy(asc(lookupUseCategory.sortOrder)) as Promise<LookupRow[]>;
    case "person-types":
      return db.select().from(lookupPersonType)
        .orderBy(asc(lookupPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "person-roles":
      return db.select().from(lookupPersonRole)
        .orderBy(asc(lookupPersonRole.name)) as Promise<LookupRow[]>;
    case "citizenships":
      return db.select().from(lookupCitizenship)
        .orderBy(asc(lookupCitizenship.sortOrder)) as Promise<LookupRow[]>;
    case "judicial-person-types":
      return db.select().from(lookupJudicialPersonType)
        .orderBy(asc(lookupJudicialPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "document-types":
      // UNCLASSIFIED (NECLASIFICAT) pinned first; rest alphabetical.
      return db.select().from(lookupDocumentType)
        .orderBy(
          sql`CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`,
          asc(lookupDocumentType.name),
        ) as Promise<LookupRow[]>;
    case "institutions":
      return db.select().from(lookupInstitution)
        .orderBy(asc(lookupInstitution.sortOrder)) as Promise<LookupRow[]>;
  }
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createValue(
  key: ListKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<LookupRow> {
  switch (key) {
    case "property-types": {
      const key = await generateUniquePropertyTypeKey(data.name);
      const [row] = await db.insert(lookupPropertyType).values({ ...data, key }).returning();
      return row as LookupRow;
    }
    case "tarla": {
      const [row] = await db.insert(lookupTarla).values(data).returning();
      return row as LookupRow;
    }
    case "use-categories": {
      const [row] = await db.insert(lookupUseCategory).values(data).returning();
      return row as LookupRow;
    }
    case "person-types": {
      const [row] = await db.insert(lookupPersonType).values(data).returning();
      return row as LookupRow;
    }
    case "person-roles": {
      const [row] = await db.insert(lookupPersonRole).values(data).returning();
      return row as LookupRow;
    }
    case "citizenships": {
      const [row] = await db.insert(lookupCitizenship).values(data).returning();
      return row as LookupRow;
    }
    case "judicial-person-types": {
      const [row] = await db.insert(lookupJudicialPersonType).values(data).returning();
      return row as LookupRow;
    }
    case "document-types": {
      const key = await generateUniqueDocumentTypeKey(data.name);
      // Slice #26.12: origin is create-only and defaults to MANUAL here rather
      // than in the Zod schema, so exactly one place decides what an unstated
      // origin means. The import path (`ensureDocType` in
      // bulk-import-dialog.tsx) is the only caller that sends "IMPORT"; a new
      // writer that forgets is labelled hand-added, which is the conservative
      // direction — it under-claims instead of crediting the machine with a
      // type Adrian typed himself.
      const origin: DocumentTypeOrigin = isDocumentTypeOrigin(data.origin)
        ? data.origin
        : "MANUAL";
      // Slice #27.03: through the same template-field choke point as the
      // update below. No admin form sends `templateFields` on a POST today —
      // the create form is built from LIST_META, which lists `name` alone —
      // but a door that sanitises on the way in and not on the way out is a
      // door that will eventually be used the other way round.
      const [row] = await db
        .insert(lookupDocumentType)
        .values({ ...sanitizeDocumentTypeTemplateFields(data), key, origin })
        .returning();
      return row as LookupRow;
    }
    case "institutions": {
      const [row] = await db.insert(lookupInstitution).values(data).returning();
      return row as LookupRow;
    }
  }
}

// ── Update ───────────────────────────────────────────────────────────────────


export async function updateValue(
  key: ListKey,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<LookupRow | null> {
  switch (key) {
    case "property-types": {
      const [row] = await db.update(lookupPropertyType).set(data).where(eq(lookupPropertyType.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "tarla": {
      const [row] = await db.update(lookupTarla).set(data).where(eq(lookupTarla.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "use-categories": {
      const [row] = await db.update(lookupUseCategory).set(data).where(eq(lookupUseCategory.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "person-types": {
      const [row] = await db.update(lookupPersonType).set(data).where(eq(lookupPersonType.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "person-roles": {
      const [row] = await db.update(lookupPersonRole).set(data).where(eq(lookupPersonRole.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "citizenships": {
      const [row] = await db.update(lookupCitizenship).set(data).where(eq(lookupCitizenship.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "judicial-person-types": {
      const [row] = await db.update(lookupJudicialPersonType).set(data).where(eq(lookupJudicialPersonType.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "document-types": {
      const [row] = await db
        .update(lookupDocumentType)
        // Two guards, composed. `stripDocumentTypeOrigin` keeps a rename from
        // re-originating an imported type (#26.12); `sanitizeDocumentType-
        // TemplateFields` keeps a hand-typed label out of the extraction
        // prompt and renumbers `order` from array position (#27.03). Both
        // named rather than inlined so each can be asserted on behaviour
        // without opening a database connection.
        .set(sanitizeDocumentTypeTemplateFields(stripDocumentTypeOrigin(data)))
        .where(eq(lookupDocumentType.id, id))
        .returning();
      return (row as LookupRow) ?? null;
    }
    case "institutions": {
      const [row] = await db.update(lookupInstitution).set(data).where(eq(lookupInstitution.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
  }
}

// ── Dependents: what is in the way, and how to move it ───────────────────────
//
// Slice #29.05. Deleting a value that is in use is a conversation: the delete
// is refused, the screen says what depends on the row and how many, and the
// user is offered a way to move those objects onto another value of the same
// list. Once nothing depends on it, the delete goes through and is permanent.
//
// WHERE THE RULES LIVE: `./dependents.ts` — one entry per list, listing the
// tables and columns that carry the row's value. Everything below is generic
// over that table, which is the point: the refusal is the same sentence for all
// nine lists, and a tenth list is an entry there rather than a branch here.

/**
 * Everything below runs inside a transaction, and the counting path opens one
 * of its own rather than reading through `db`.
 *
 * The reason is prosaic: a union of `db` and the transaction handle is a union
 * of two query builders, which TypeScript will not call.
 *
 * ⚠️ **It is NOT a consistent read, and an adversarial round corrected an
 * earlier version of this comment that said it was.** `db.transaction()`
 * issues a bare `BEGIN`, so it runs at Postgres' default READ COMMITTED, where
 * every statement takes its own snapshot — `person-roles`' six counts are six
 * snapshots inside the transaction exactly as they would be outside it.
 * Raising the level would buy consistency and a 40001 to handle, and it is not
 * where the guarantee is needed: what gates the DESTRUCTIVE step is the row
 * lock in `sourceValue`, taken by `deleteValue` alone. The counting path is a
 * best-effort read, and a number that is one row stale between the dialog
 * opening and the button being pressed is caught by the delete's own recount
 * under that lock.
 */
type Conn = DbTransaction;

/**
 * The value a dependent row would be carrying: the lookup row's id, except on
 * `tarla`, where `property.tarla_sola` holds the INDICATIV as text.
 *
 * Returns `undefined` when the row does not exist.
 *
 * `lock` takes a row-level `FOR UPDATE`, and it is doing real work rather than
 * being defensive noise: Postgres' referential-integrity check takes a
 * `FOR KEY SHARE` on the parent row before allowing an insert that references
 * it, and `FOR KEY SHARE` conflicts with `FOR UPDATE`. So a document being
 * created while this transaction counts documents waits for it, and the count
 * cannot go stale between the count and the delete. (On `tarla` there is no
 * foreign key, so the lock buys nothing there — a property saved with the same
 * text mid-transaction is a race this cannot close. Single business user; the
 * honest note is here rather than a claim on screen.)
 */
async function sourceValue(
  conn: Conn,
  def: ListDependencies,
  id: string,
  lock = false,
): Promise<unknown> {
  const q = conn.select({ v: def.source }).from(def.table).where(eq(def.idColumn, id));
  const rows = lock ? await q.for("update") : await q;
  const value = rows.length > 0 ? rows[0].v : undefined;
  // ⚠️ **NULL is treated as "no row", not as a value to match on.** Today
  // unreachable — `lookup_tarla.indicativ` is NOT NULL and the other eight
  // sources are primary keys — but the day a value-matched list points
  // `source` at a nullable column, `eq(column, null)` is `column = NULL`,
  // which is never true, so every count would come back zero and the delete
  // would be offered as safe. One line, and it is the exact failure this
  // slice exists to prevent.
  return value === null ? undefined : value;
}

async function countRef(conn: Conn, ref: DependentRef, value: unknown): Promise<number> {
  const rows = await conn.select({ n: count() }).from(ref.table).where(eq(ref.column, value));
  return Number(rows[0]?.n ?? 0);
}

/**
 * Merge counts by label, so two refs that describe the same kind of object to
 * a user read as one number rather than as the same word twice. Today only
 * `document-types` and `institutions` share a label across lists; the merge is
 * here so that a second column on the same table later cannot produce
 * "3 documents, 2 documents".
 */
function addCount(into: DependentCount[], labelKey: string, n: number): void {
  if (n <= 0) return;
  const existing = into.find((d) => d.labelKey === labelKey);
  if (existing) existing.count += n;
  else into.push({ labelKey, count: n });
}

/**
 * How many OTHER rows of this list carry the same value.
 *
 * Only ever non-zero on `tarla`, where nothing makes `indicativ` unique — the
 * admin add form will happily take a second "T1". It matters because the
 * dependents there are matched by TEXT: if another row still supplies "T1",
 * the properties carrying "T1" lose nothing when this row goes, so refusing
 * the delete would strand it forever (an adversarial round found exactly that
 * dead end: the twin cannot be deleted, and cannot be moved either, because
 * moving onto its identical sibling is a no-op).
 */
async function siblingsSharingValue(
  conn: Conn,
  def: ListDependencies,
  id: string,
  value: unknown,
): Promise<number> {
  const rows = await conn
    .select({ n: count() })
    .from(def.table)
    .where(and(eq(def.source, value), ne(def.idColumn, id)));
  return Number(rows[0]?.n ?? 0);
}

async function buildReport(
  conn: Conn,
  list: ListKey,
  id: string,
  value: unknown,
): Promise<DependentsReport> {
  const def = LIST_DEPENDENCIES[list];
  const dependents: DependentCount[] = [];
  const removedWithRow: DependentCount[] = [];
  let notes = dependentNotes(list);

  // The shared-value case above. When it holds, nothing DEPENDS on this row
  // any more — the value survives it — so the objects are not counted at all
  // and the note says why. Counting them and then allowing the delete anyway
  // would be a number that means something different from what it says.
  const shared =
    matchesByValue(def) && (await siblingsSharingValue(conn, def, id, value)) > 0;
  if (shared) {
    // `tarlaFreeText` explains a number ("the count above finds them by that
    // text") that is deliberately not shown in this case, so leaving both in
    // prints two sentences that disagree about whether anything was counted.
    // The twin is the whole story here.
    notes = notes.filter((n) => n !== "tarlaFreeText");
    notes.push("duplicateValue");
  }

  // Sequential rather than Promise.all: inside a transaction these share one
  // connection, and the ordering of the report is the map's order either way.
  for (const ref of def.refs) {
    const n = await countRef(conn, ref, value);
    if (ref.configuration) addCount(removedWithRow, ref.labelKey, n);
    else if (!shared) addCount(dependents, ref.labelKey, n);
  }

  return {
    total: dependents.reduce((sum, d) => sum + d.count, 0),
    dependents,
    removedWithRow,
    notes,
  };
}

/**
 * What depends on one lookup row, live. `null` when the row does not exist.
 */
export async function countDependents(
  list: ListKey,
  id: string,
): Promise<DependentsReport | null> {
  const def = LIST_DEPENDENCIES[list];
  return db.transaction(async (tx) => {
    const value = await sourceValue(tx, def, id);
    if (value === undefined) return null;
    return buildReport(tx, list, id, value);
  });
}

/**
 * Move the rows one ref covers from one value to another. Returns how many.
 *
 * ⚠️ **Configuration refs never reach this function** — see `configuration` in
 * ./dependents.ts. An adversarial round found what the first draft did with
 * them: `lookup_property_person_role` is UNIQUE on the role, so "moving" a
 * whitelist tick onto a role that already had one deleted a row and updated
 * nothing, and the dialog then reported "nothing was moved" immediately after
 * destroying a row. They are not objects that can be re-pointed; they are the
 * row's own settings, and they go with it.
 */
async function moveRef(
  tx: DbTransaction,
  ref: DependentRef,
  from: unknown,
  to: unknown,
): Promise<number> {
  const table  = sql.identifier(getTableName(ref.table));
  const column = sql.identifier(ref.column.name);

  // Raw SQL rather than the query builder because `ref.table` is a generic
  // `PgTable` here: `.set()` on one has no column types to check against, so
  // the builder would buy nothing that `sql.identifier` does not. The column
  // name comes from the schema object either way — there is no string literal
  // to mistype. `${column}` is deliberately UNQUALIFIED: a `SET "t"."c" = …`
  // is a syntax error in Postgres.
  const moved = await tx.execute(
    sql`UPDATE ${table} SET ${column} = ${to} WHERE ${column} = ${from} RETURNING 1`,
  );
  return moved.rows.length;
}

export type ReassignOutcome =
  | { ok: true; moved: DependentCount[]; total: number }
  | { ok: false; reason: "not-found" | "same-value" | "ambiguous-value" };

/**
 * ⚠️ **NOTICED, NOT FIXED — the move writes no version row.** `property` and
 * `document` are versioned by full snapshot, and their snapshots carry
 * `propertyTypeId` / `tarlaSola` / `documentTypeId` — the very columns this
 * rewrites. `updateProperty` and `updateDocument` write a version when the
 * snapshot changes; this bulk UPDATE does not, and it does not touch
 * `updated_by` either. The visible consequence is attribution: the NEXT
 * ordinary edit to one of these objects writes a version whose diff includes
 * the type change, under whoever made that edit. Doing it properly means
 * building each entity's snapshot from inside a generic mover, which is a
 * slice of its own; it is in the handover with that shape.
 */
export async function reassignDependents(
  list: ListKey,
  fromId: string,
  toId: string,
): Promise<ReassignOutcome> {
  if (fromId === toId) return { ok: false, reason: "same-value" };
  const def = LIST_DEPENDENCIES[list];

  return db.transaction(async (tx) => {
    // Both rows locked, in id order. The order is what keeps two
    // administrators moving values at each other from deadlocking; the lock
    // itself is what stops a new dependent arriving between the move and the
    // delete that follows it (see `sourceValue`).
    const [firstId, secondId] = fromId < toId ? [fromId, toId] : [toId, fromId];
    await sourceValue(tx, def, firstId, true);
    await sourceValue(tx, def, secondId, true);

    const from = await sourceValue(tx, def, fromId);
    const to   = await sourceValue(tx, def, toId);
    if (from === undefined || to === undefined) {
      return { ok: false, reason: "not-found" } as const;
    }
    // Two `tarla` rows can carry the same indicativ — nothing makes it unique
    // — and then moving one onto the other would rewrite nothing while
    // reporting a move. Different rows, same value, so: same value.
    if (from === to) return { ok: false, reason: "same-value" } as const;

    // ⚠️ **A value-matched row with a twin cannot be moved at all**, and this
    // is the second half of the dead end `siblingsSharingValue` describes. The
    // properties carrying "T1" belong to BOTH rows equally — nothing in the
    // data says which — so rewriting them to "T3" would silently take away the
    // twin's properties too. The screen never offers this (the twin makes the
    // blocking count zero, so the delete is offered instead of the move); this
    // guard is for a caller that reaches the endpoint directly.
    if (matchesByValue(def) && (await siblingsSharingValue(tx, def, fromId, from)) > 0) {
      return { ok: false, reason: "ambiguous-value" } as const;
    }

    const moved: DependentCount[] = [];
    for (const ref of def.refs) {
      // Configuration goes with the row when it is deleted; it is not moved.
      if (ref.configuration) continue;
      addCount(moved, ref.labelKey, await moveRef(tx, ref, from, to));
    }
    return {
      ok: true,
      moved,
      total: moved.reduce((sum, d) => sum + d.count, 0),
    } as const;
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────
//
// Slice #29.04: the row is deleted. This is also what the route's own header
// comment has claimed since it was written — "hard delete (lookup rows have
// no soft-delete)" — so this makes the documentation true rather than
// rewriting it.
//
// Freeing the key is the point. `lookup_document_type.key` carries a real
// UNIQUE constraint, and a tombstoned row went on occupying it forever: that
// is why deleting "ZZZ Proba" and creating it again produced
// ZZZ_PROBA_SLICE_2901_2. See generateUniqueDocumentTypeKey above, which
// deliberately does NOT filter and is correct precisely because of that
// constraint.
//
// Slice #29.05: and it is refused while anything depends on it — for all nine
// lists, in application code, because the database only refuses on one of the
// fourteen edges that reach them. The nine-way switch this function was is
// gone: the table to
// delete from is `LIST_DEPENDENCIES[key].table`, which is the same entry the
// count and the re-point read, so a list cannot be counted under one rule and
// deleted under another. (The guard that used to pin all nine branches to a
// `db.delete` now pins the map instead — see hard-delete-single-source.test.ts
// → "deleting a lookup value really removes the row".)

export type DeleteOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "in-use"; report: DependentsReport };

export async function deleteValue(key: ListKey, id: string): Promise<DeleteOutcome> {
  const def = LIST_DEPENDENCIES[key];

  return db.transaction(async (tx) => {
    const value = await sourceValue(tx, def, id, true);
    if (value === undefined) return { ok: false, reason: "not-found" } as const;

    const report = await buildReport(tx, key, id, value);
    if (report.total > 0) return { ok: false, reason: "in-use", report } as const;

    const deleted = await tx
      .delete(def.table)
      .where(eq(def.idColumn, id))
      .returning({ id: def.idColumn });
    if (deleted.length === 0) return { ok: false, reason: "not-found" } as const;
    return { ok: true } as const;
  });
}
