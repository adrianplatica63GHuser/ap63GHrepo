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
 *
 * Slice #29.13: nine became eleven. The two relationship-role lists joined
 * `VALID_LIST_KEYS` rather than gaining a second guard of their own (see
 * ./config.ts), so all this file owes them is a `case` in the three switches
 * below — the count, the move and the delete were already generic over
 * LIST_DEPENDENCIES and reached them the moment the map did.
 * What the user is told, and the offer to move the dependents onto another
 * value first, are in `./dependents.ts`, `buildReport` and the dialog.
 *
 * Slice #29.14: the move records itself. Every object it rewrites gets its
 * `updated_by` stamped from the acting session and, where the snapshot really
 * changed, a version row — written inside the move's own transaction by the
 * entity's own comparison. See ./move-history.ts and the header above
 * `reassignDependents`.
 *
 * Slice #34.01: every branch of `listValues` now ends its `ORDER BY` on the
 * list's own required field, so a list reads back in the same order every
 * time — on every list but `document-types`, whose `name` is not unique even
 * in practice. See the header above `listValues`.
 *
 * Create and update still dispatch on the ListKey string via a switch —
 * verbose but fully type-safe within each case. The delete no longer does:
 * it reads its table from the same map the count and the move read.
 *
 * lookup_others was dropped in migration_052. ("groups" moved to its own
 * feature in Slice #18.07 — see src/lib/groups/.)
 */

import { asc, count, eq, getTableName, like, sql } from "drizzle-orm";
import { nextFreeKey, requestedDocumentTypeKey, slugifyLookupKey } from "./keys";
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
  lookupPropertyPropertyRole,
  lookupDocumentDocumentRole,
} from "@/db/schema";
import type { ListKey } from "./config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordMoveHistory } from "./move-history";
import {
  LIST_DEPENDENCIES,
  dependentNotes,
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
  documentTypeHasForm,
  isDocumentTypeOrigin,
  type DocumentTypeOrigin,
} from "@/lib/documents/status";
import {
  IdCardFormRefusedError,
  idCardFormRefusal,
} from "@/lib/documents/id-card-form-guard";
import {
  DocumentTypeKeyRefusedError,
  DocumentTypeNameTakenError,
  documentTypeKeyRefusal,
  documentTypeNameTakenBy,
} from "@/lib/documents/document-type-name-guard";
import { normaliseDocumentTypeName } from "@/lib/documents/document-type-match";
import {
  CatchAllFormRefusedError,
  catchAllFormRefusal,
} from "@/lib/documents/catch-all-form-guard";
import { parseTemplateFields } from "@/lib/documents/template-fields";

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
  // ⚠️ **`lookupDocumentType` alone since Slice #34.03 (D-23), and the
  // narrowing is the point rather than tidying.** This parameter was a union
  // with `lookupPropertyType`, and that union was the only reason a key was
  // still being generated for property types: one generator served two tables,
  // one of which stopped having a reader when migration_041 replaced
  // `src/lib/properties/type-config.ts` with the three `show*` booleans. A
  // union of one is a type error at any future call site that tries to widen
  // it back without saying why.
  table: typeof lookupDocumentType,
  name: string,
  conn: DbTransaction | typeof db = db,
  preferredBase?: string | null,
): Promise<string> {
  // Slice #29.07: `preferredBase` is a key the CODEBASE already defines — see
  // `createDocumentTypeRow`. It replaces the slug as the base and nothing else
  // about the rule changes, so a preferred key that is somehow taken still gets
  // the `_2` treatment rather than colliding on INSERT.
  const base = preferredBase?.trim() || slugifyLookupKey(name);
  const rows = await conn
    .select({ key: table.key })
    .from(table)
    .where(like(table.key, `${base}%`));
  const taken = new Set(rows.map((r) => r.key));
  return nextFreeKey(base, (k) => taken.has(k));
}

async function generateUniqueDocumentTypeKey(
  name: string,
  conn: DbTransaction | typeof db = db,
  preferredBase?: string | null,
): Promise<string> {
  return generateUniqueKey(lookupDocumentType, name, conn, preferredBase);
}

// Slice #34.03 (D-23): `generateUniquePropertyTypeKey` was here, and it is
// gone. It generated `lookup_property_type.key` on every insert — a column
// read by NO application code since migration_041 replaced
// `src/lib/properties/type-config.ts` with `show_tarla_parcela` /
// `show_address` / `show_street_view` on the table itself. The only read left
// in `src/` was this generator's own uniqueness probe: it existed to keep
// unique a value nothing consulted.
//
// The column is left in place, nullable (it always was — migration_039 adds it
// with no NOT NULL), so rows created before #34.03 keep their slug and rows
// created after hold NULL. Neither is read. migration_078 leaves a COMMENT on
// the column saying so, and `scripts/verify-rebuild.ts` no longer asserts a
// key on this table. `lookup_document_type.key` is untouched and still
// required: it is the immutable slug all document matching and seeding run on.

// ── List ─────────────────────────────────────────────────────────────────────

/**
 * One list, in a STABLE order.                                 (Slice #34.01)
 *
 * ⚠️ **`ORDER BY sort_order` alone is not an order — it is a partial one, and
 * Postgres is free to break the ties differently on every read.** Nothing in
 * the admin UI can set `sort_order`: `LIST_META` (./config.ts) exposes no such
 * field, so the add form never sends one and `validation.ts` defaults it to
 * `0`. Every row created after the seed therefore ties at zero with every
 * other row created after the seed, and seven of the eleven lists had nothing
 * after that to separate them. On „Indicative Tarla" — the one list an
 * object-creation path writes to, from `createPropertyIn` — that is not a
 * corner case but the normal state: every auto-seeded code lands at zero, so
 * at fifty codes the list was fifty rows in an order that changed between page
 * loads.
 *
 * The fix is a SECOND SORT KEY, not a new input. Each branch below ends on the
 * list's own required, user-entered field — `name` on ten lists, `indicativ`
 * on `tarla` — which makes the key total in practice, leaves `sort_order`
 * doing exactly what it did for the rows that have one, and needs no
 * migration, no form field and no data change.
 *
 * ⚠️ **"IN PRACTICE" IS DOING WORK: NO LOOKUP TABLE HAS A UNIQUE CONSTRAINT ON
 * ITS DISPLAY FIELD — EXCEPT `document-types`, SINCE SLICE #34.09.**
 * migration_080 puts a partial unique index over the NORMALISED name on
 * `lookup_document_type`, so on that one list a tie is no longer reachable at
 * all: two rows the ORDER BY could not separate would have to hold the same
 * name, and the database now refuses the second. The paragraph below is left
 * standing for the other ten, where it is still exactly true; the
 * `document-types` bullet inside it is corrected in place.
 * Two rows sharing BOTH keys can still swap. On the four
 * lists whose name is the only column — `use-categories`, `person-types`,
 * `citizenships`, `judicial-person-types` — that cannot be seen: the two lines
 * read the same. On the other seven it can, because the modal renders every
 * `LIST_META` field as a column (`displayFields = meta.fields`,
 * value-list-modal.tsx), so tied rows visibly exchange places.
 *
 * Two of those seven are worse than cosmetic:
 *   • `document-types`, where duplicate names WERE documented and EXPECTED —
 *     that sentence went on to say "only `key` is UNIQUE, and
 *     `matchDocumentType` takes the FIRST name match, so a tie decides which of
 *     two same-named types an import ADOPTS, not merely where a row sits". True
 *     until Slice #34.09, which made the tie unreachable: two rows can no
 *     longer hold one name. `matchDocumentType` still takes the first match and
 *     the restated ORDER BY in resolve-document-type.ts is still load-bearing —
 *     what is gone is the case where "first" was a coin toss.
 *   • `tarla`, where ties at `sort_order = 0` are the normal state rather than
 *     an edge case, because `createPropertyIn` auto-seeds every code there.
 * Neither is changed by this slice — document-types is one of the four
 * branches it does not touch — and both are in the #34.01 handover. A third
 * key (`id`) is the one-line fix if either bites.
 *
 * ⚠️ **THE OTHER FOUR BRANCHES ALREADY HAD A TIEBREAKER AND ARE UNTOUCHED —
 * AND TWO OF THEM MUST NEVER BE HARMONISED INTO `sort_order, name`.**
 *   • `person-roles` orders by `name` ALONE. Its `sort_order` reaches no
 *     screen at all, and its seeded 1..N is a numbering of the seed list
 *     rather than a curated order — reading it would pin every role added
 *     since (all of them at zero) above the 56 seeded ones AND reshuffle a
 *     seventh of those. Slice #34.01 resolved the column the other way
 *     instead: `personRoleSchema` no longer writes it. The full argument, and
 *     the one non-screen reader that does not count, are in ./validation.ts.
 *   • `document-types` pins UNCLASSIFIED first and then orders by `name`. That
 *     pin is load-bearing: `matchDocumentType` takes the first name match, and
 *     src/lib/documents/resolve-document-type.ts restates the same clause
 *     deliberately rather than importing it.
 *   • the two relationship-role lists were already `sort_order, name` — they
 *     are the shape the seven above now copy.
 *
 * **A twelfth list must end its `ORDER BY` on a required field too.**
 * `src/__tests__/value-list-ordering.test.ts` reads this function's source and
 * fails when a branch's last sort term is `sortOrder`, or when it has no
 * `orderBy` at all.
 */
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
        .orderBy(
          asc(lookupPropertyType.sortOrder),
          asc(lookupPropertyType.name),
        ) as Promise<LookupRow[]>;
    case "tarla":
      return db.select().from(lookupTarla)
        .orderBy(
          asc(lookupTarla.sortOrder),
          // `indicativ` rather than `name` — it is this list's required field.
          asc(lookupTarla.indicativ),
        ) as Promise<LookupRow[]>;
    case "use-categories":
      return db.select().from(lookupUseCategory)
        .orderBy(
          asc(lookupUseCategory.sortOrder),
          asc(lookupUseCategory.name),
        ) as Promise<LookupRow[]>;
    case "person-types":
      return db.select().from(lookupPersonType)
        .orderBy(
          asc(lookupPersonType.sortOrder),
          asc(lookupPersonType.name),
        ) as Promise<LookupRow[]>;
    case "person-roles":
      return db.select().from(lookupPersonRole)
        .orderBy(asc(lookupPersonRole.name)) as Promise<LookupRow[]>;
    case "citizenships":
      return db.select().from(lookupCitizenship)
        .orderBy(
          asc(lookupCitizenship.sortOrder),
          asc(lookupCitizenship.name),
        ) as Promise<LookupRow[]>;
    case "judicial-person-types":
      return db.select().from(lookupJudicialPersonType)
        .orderBy(
          asc(lookupJudicialPersonType.sortOrder),
          asc(lookupJudicialPersonType.name),
        ) as Promise<LookupRow[]>;
    case "document-types":
      // UNCLASSIFIED (NECLASIFICAT) pinned first; rest alphabetical.
      return db.select().from(lookupDocumentType)
        .orderBy(
          sql`CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`,
          asc(lookupDocumentType.name),
        ) as Promise<LookupRow[]>;
    case "institutions":
      return db.select().from(lookupInstitution)
        .orderBy(
          asc(lookupInstitution.sortOrder),
          asc(lookupInstitution.name),
        ) as Promise<LookupRow[]>;
    // Slice #29.13: sort order then name — the ordering their own
    // `listPropertyPropertyRoles` / `listDocumentDocumentRoles` used, kept so
    // the rows do not rearrange themselves the day the modal changes.
    case "property-property-roles":
      return db.select().from(lookupPropertyPropertyRole)
        .orderBy(
          asc(lookupPropertyPropertyRole.sortOrder),
          asc(lookupPropertyPropertyRole.name),
        ) as Promise<LookupRow[]>;
    case "document-document-roles":
      return db.select().from(lookupDocumentDocumentRole)
        .orderBy(
          asc(lookupDocumentDocumentRole.sortOrder),
          asc(lookupDocumentDocumentRole.name),
        ) as Promise<LookupRow[]>;
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
      // Slice #34.03: no generated `key` — see the note above
      // `generateUniqueKey`. This branch is now the same plain insert as the
      // nine below it.
      const [row] = await db.insert(lookupPropertyType).values(data).returning();
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
    case "document-types":
      // Slice #29.06: through the one function that knows how a document type
      // row is built. Everything about the row is decided there — see
      // `createDocumentTypeRow`, which the classifier's resolver calls INSIDE
      // its own advisory lock.
      //
      // ⚠️ **The transaction is here so there is ONE shape, and it buys NOTHING
      // ELSE — an eighth review round asked, and the honest answer is worth
      // writing down.** `createDocumentTypeRow` needs a transaction handle
      // because the resolver has to run it under a lock; giving it one here is
      // what lets both doors share the function. Under READ COMMITTED a
      // `SELECT keys` then `INSERT` inside `BEGIN…COMMIT` guarantees exactly
      // what the two autocommit statements it replaced did.
      //
      // ⚠️ **THE PARAGRAPH THAT STOOD HERE SAID THIS DOOR "PERFORMS NO NAME
      // CHECK AT ALL", AND SLICE #34.09 IS THE HANDOVER LINE IT ENDED ON COMING
      // BACK.** Quoted rather than deleted, because the reasoning is still the
      // reason the fix is shaped the way it is: "Its duplicate-name refusal
      // lives in the CLIENT (`sameTypeName` in the discovery review dialog,
      // against a list react-query may have held for five minutes), so two rows
      // with one display name are reachable through it by a stale list rather
      // than by a race — and a lock cannot serialise against a check that is not
      // being made. The fix is a unique index on the normalised name, which
      // needs a migration; it is in the handover."
      //
      // Both halves now exist. `createDocumentTypeRow` asks
      // `documentTypeNameTakenBy` on the connection it is given, and
      // migration_080's partial unique index closes the race that a read and
      // then a write cannot. A LOCK is still deliberately not taken here, and
      // now for a better reason than "it would not help": the index is the
      // serialisation, and it serialises the classifier's door as well without
      // either door having to know about the other.
      //
      // ⚠️ **`key` IS LIFTED OUT OF THE PAYLOAD AND PASSED AS A PARAMETER, NOT
      // LEFT ON `data`.** That is not ceremony — see the ⚠️ on
      // `createDocumentTypeRow`, whose entire safety argument is that a key
      // never arrives as a field on the object that becomes the row. Slice
      // #34.09 lets a PERSON express a key (D-03) and does it through the
      // channel #29.07 already built for the classifier, so what changes is who
      // may pass the third argument, not how the row is built. The rest of the
      // payload goes on untouched.
      //
      // ⚠️ **AND IT IS JUDGED BEFORE THE TRANSACTION OPENS.**
      // `documentTypeKeyRefusal` is the whole of what a typed key must satisfy
      // — it slugs to something, the slug is not longer than the archive
      // allows, and it is not a key the codebase itself matches on unless the
      // NAME agrees. That last arm is a hole this slice OPENED: before it, a
      // key was always the slug of a name, so a row could only be keyed
      // `NECLASIFICAT` by being named something that slugs to it. See the
      // function's own ⚠️ for the measured sequence.
      const keyRefusal = documentTypeKeyRefusal(data.key, data.name);
      if (keyRefusal !== null) throw new DocumentTypeKeyRefusedError(keyRefusal);
      return db.transaction((tx) => {
        const { key: _requested, ...rest } = data as Record<string, unknown>;
        void _requested;
        return createDocumentTypeRow(tx, rest, requestedDocumentTypeKey(data.key));
      });
    case "institutions": {
      const [row] = await db.insert(lookupInstitution).values(data).returning();
      return row as LookupRow;
    }
    case "property-property-roles": {
      const [row] = await db.insert(lookupPropertyPropertyRole).values(data).returning();
      return row as LookupRow;
    }
    case "document-document-roles": {
      const [row] = await db.insert(lookupDocumentDocumentRole).values(data).returning();
      return row as LookupRow;
    }
  }
}

/**
 * Build one `lookup_document_type` row, on a connection the caller controls.
 *                                                              (Slice #29.06)
 *
 * ⚠️ **THE `conn` PARAMETER IS THE WHOLE POINT, and a seventh adversarial round
 * is why it exists.** `resolveClassifiedDocumentType` has to take a Postgres
 * advisory lock on the type's NAME and then read-and-insert inside it, because
 * without that two concurrent creates of one label BOTH SUCCEED and neither
 * ever errors: the key generator below re-reads before every insert, so the
 * loser simply computes `..._2` and commits a second row with the same display
 * name. That is finding F7 — two types from one document — surviving inside its
 * own fix, and no retry can catch it, because there is nothing to retry.
 *
 * An insert on `db` cannot be inside the caller's transaction, so the caller
 * cannot hold a lock around `createValue`. Hence this: one implementation of
 * how the row is built, reachable on either connection.
 *
 * ⚠️ **Key generation is INSIDE the same connection**, not outside it. A key
 * chosen on `db` and inserted on `tx` would be chosen against a snapshot the
 * lock does not cover, which is the same race one level down.
 */
/**
 * `createDocumentTypeRow` refused to substitute a suffixed key for the
 * canonical one it was asked for.                              (Slice #29.07)
 *
 * A sentinel message rather than an error subclass, so the one caller that
 * cares can test it without importing a class through three modules, and every
 * other caller sees an ordinary Error it did not ask to handle.
 */
export const PREFERRED_KEY_TAKEN = "preferred-document-type-key-taken";

export async function createDocumentTypeRow(
  conn: DbTransaction,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  preferredKey?: string | null,
): Promise<LookupRow> {
  // ── The display name, before anything else is decided.      (Slice #34.09)
  //
  // ⚠️ **A READ AND THEN A WRITE, WHICH IS NOT ATOMIC — AND THAT IS WHY THERE
  // IS ALSO AN INDEX.** Two administrators creating „Act adițional" in the same
  // instant both read a table without it and both insert; migration_080's
  // partial unique index is what makes the loser fail, and both routes map that
  // 23505 to this same refusal so the two arrive as one sentence. This check
  // exists for the case that actually happens — a stale client list — where the
  // index would otherwise produce a bare Postgres error.
  //
  // ⚠️ **ON `conn`, NEVER ON `db`.** `resolveClassifiedDocumentType` runs this
  // function inside a transaction holding an advisory lock on the normalised
  // name; a read on `db` would be a read outside that lock, against a snapshot
  // it does not cover, which is the same race one level down that
  // `generateUniqueDocumentTypeKey`'s own ⚠️ warns about.
  //
  // ⚠️ **IT IS A NO-OP ON THE RESOLVER'S PATH, AND IS STILL ASKED THERE.**   That
  // caller has already name-matched the rows it read under the lock and ADOPTS
  // on a match, so it only ever reaches here with a name no row holds. Asking
  // anyway is what makes the rule a property of how a document-type row is
  // built rather than of which door built it — this function's whole reason for
  // existing (#29.06) — and it costs one read of about forty
  // rows — a sequential scan of a lookup table, not an index lookup, which is
  // what reading every row for a comparison only TypeScript can make costs.
  // `resolveClassifiedDocumentType`'s retry loop treats the refusal as a lost
  // race and goes round to adopt, which is the correct answer if it ever does
  // fire.
  //
  // The whole table is read rather than a `WHERE`: the comparison is
  // `sameDocumentTypeName`, and there is exactly one definition of it — in
  // TypeScript. A SQL predicate restating the fold would be a second opinion
  // about the rule, which is the shape this slice exists to remove.
  const existing = await conn
    .select({ id: lookupDocumentType.id, key: lookupDocumentType.key, name: lookupDocumentType.name })
    .from(lookupDocumentType);
  const nameTakenBy = documentTypeNameTakenBy(data.name, existing);
  if (nameTakenBy !== null) throw new DocumentTypeNameTakenError(nameTakenBy.name);
  // Slice #29.07: the canonical key, when the classifier offered one this
  // codebase defines.
  //
  // ⚠️ **A PARAMETER OF ITS OWN, NEVER A FIELD ON `data`, AND THE DISTINCTION
  // IS STILL THE WHOLE SAFETY ARGUMENT — BUT WHAT IT PROTECTS AGAINST CHANGED
  // IN SLICE #34.09, SO THE OLD SENTENCE IS QUOTED RATHER THAN LEFT STANDING.**
  // It read: "…so the two doors that are a PERSON (the Reference Data form and
  // the discovery review dialog) call this with two arguments and cannot
  // express a key at all, whatever their request body happens to contain.
  // Exactly one caller passes a third: `resolveClassifiedDocumentType`…".
  //
  // The Reference Data form now passes a third, because D-03 decided it should:
  // `key` is an immutable slug that all document matching runs on, the form
  // asked only for a NAME, and the working method for getting the key you
  // wanted was therefore to type `CONTRACT_VANZARE` as the name, let it slug,
  // and rename the row afterwards — a rule you had to remember, written down in
  // Adrian's own `New.DocTypes.docx`. Two doors pass a third argument now: this
  // one, from `requestedDocumentTypeKey` (which folds and uppercases but never
  // invents), and the resolver, from `canonicalTypeKey` — i.e. from
  // `KNOWN_DOCUMENT_TYPES`, not from the wire. The discovery review dialog
  // still passes none.
  //
  // ⚠️ **WHAT THE PARAMETER IS FOR IS UNCHANGED, AND IT IS WHY A PERSON MAY
  // NOW USE IT.** The old worry was "a client that chose one would eventually
  // choose a collision". A collision is precisely what the `PREFERRED_KEY_TAKEN`
  // refusal below answers, out loud, instead of quietly storing `..._2`. A key
  // arriving as a FIELD on `data` would have no such treatment: it would be
  // spread into `.values()` and take whatever `nextFreeKey` had nothing to say
  // about. So the field/parameter distinction is what makes the form's key safe
  // rather than what kept it out.
  //
  // ⚠️ **AND THE NAME IS CHECKED BEFORE ANY OF IT.** See below: until #34.09
  // this function's own `createValue` branch said in as many words that this
  // door "performs no name check at all".
  //
  // ⚠️ **What it fixes is finding F6.** Without it every created type was
  // slugged from the free-text LABEL, so a document the model classified
  // CARTE_IDENTITATE — a key on the whitelist — landed under
  // `CARTE_DE_IDENTITATE`, and `ID_CARD_TYPE_KEYS`, `type-config.ts` and
  // `getPersonIdCardLink` were all matching a key that would never appear in
  // that database again.
  //
  // ⚠️ **It cannot steal a key from an existing row.** A preferred key only
  // reaches here from the create branch of the resolver, which is only entered
  // when no stored row carries that key — and it is re-decided INSIDE the
  // advisory lock, so a racer that committed the row first is adopted rather
  // than created against. `nextFreeKey` is still the backstop if both of those
  // are somehow wrong.
  const key = await generateUniqueDocumentTypeKey(data.name, conn, preferredKey);
  // ⚠️ **A PREFERRED KEY IS TAKEN OR NOT — IT IS NEVER SUFFIXED, and an
  // adversarial round is why this is five lines rather than none.**
  // `nextFreeKey` answers `CARTE_IDENTITATE_2` when `CARTE_IDENTITATE` is
  // held, which is the right answer for a name slug and the WRONG one for a
  // canonical key: a `_2` row is a row every carve-out matching the literal key
  // will miss, which is finding F6 rebuilt with the canonical key in place of
  // the label slug. It is reachable — the resolver's advisory lock is keyed on
  // the label, so two answers carrying ONE canonical key and TWO different
  // labels do not serialise against each other, and the loser's re-read inside
  // its own lock can still miss a row the winner commits a moment later. There
  // is nothing to invent at that point: the row the loser wanted now exists, so
  // the honest move is to fail and let `resolveClassifiedDocumentType` go round
  // again, see it, and ADOPT it. That is the same shape as the 23505 retry
  // beside it, and it is caught in the same place.
  const wanted = preferredKey?.trim();
  if (wanted && key !== wanted) throw new Error(PREFERRED_KEY_TAKEN);
  // Slice #26.12: origin is create-only and defaults to MANUAL here rather
  // than in the Zod schema, so exactly one place decides what an unstated
  // origin means. A new writer that forgets is labelled hand-added, which
  // is the conservative direction — it under-claims instead of crediting
  // the machine with a type Adrian typed himself.
  //
  // Slice #29.06 settled the rule the default is the other half of:
  // **origin says WHO CHOSE THE NAME.** A machine chose it → IMPORT; a
  // person chose or confirmed it → MANUAL. So there is exactly one caller
  // that sends "IMPORT" — `resolveClassifiedDocumentType` in
  // src/lib/documents/resolve-document-type.ts, where the value is a
  // property of the function rather than a parameter a third caller could
  // forget — and the two callers that reach this default are both a
  // PERSON: the Reference Data create form, and the discovery review
  // dialog, whose own header argues at length for MANUAL. Until #29.06,
  // `ai-interpret` also reached this default, and it was neither: a type
  // the machine invented read "Adăugat manual" and no screen could repair
  // it. That was finding F2 of the 29.01 report.
  const origin: DocumentTypeOrigin = isDocumentTypeOrigin(data.origin)
    ? data.origin
    : "MANUAL";
  // Slice #27.03: through the same template-field choke point as the
  // update below. No admin form sends `templateFields` on a POST today —
  // the create form is built from LIST_META, which since Slice #34.09 lists
  // `name` and a `createOnly` `key`, and no `templateFields` on either verb —
  // but a door that sanitises on the way in and not on the way out is a
  // door that will eventually be used the other way round.
  const values = sanitizeDocumentTypeTemplateFields(data);
  // ⚠️ **AN IDENTITY-CARD TYPE MAY NOT BE CREATED WITH A FORM.** (Slice #32.07.)
  // The second of the two value-lists doors, guarded for exactly the reason the
  // sanitiser above it is: no admin form sends `templateFields` on a POST
  // today, and a door that judges on the way in and not on the way out is a
  // door that will eventually be used the other way round. `key` is the
  // GENERATED one rather than the preferred one, because that is what the row
  // will actually carry.
  //
  // ⚠️ Unreachable from `resolveClassifiedDocumentType`, which never sends
  // `templateFields` — so minting an identity-card type mid-import is NOT
  // refused here, and that is deliberate: the archive needs a CARTE_IDENTITATE
  // row to file cards under. What the resolver does instead is TELL the caller,
  // through `DocumentTypeResolution.isIdCard`.
  const createRefusal = idCardFormRefusal(
    null,
    {
      key,
      name: typeof data.name === "string" ? data.name : "",
      hasForm: documentTypeHasForm(values.templateFields),
    },
    (values as { templateFields?: unknown }).templateFields !== undefined,
  );
  if (createRefusal !== null) throw new IdCardFormRefusedError(createRefusal);
  // ⚠️ **AND THE CATCH-ALL MAY NOT BE CREATED WITH A FORM EITHER.** (Slice
  // #32.19, finding S-02.) Here for the same reason the identity-card refusal
  // is: no admin form sends `templateFields` on a POST today, and a door that
  // judges on the way in and not on the way out is a door that will eventually
  // be used the other way round.
  //
  // ⚠️ **Reachable from `resolveClassifiedDocumentType` in a way the id-card
  // guard above is not — and it still does not fire there.** The resolver mints
  // types mid-import and never sends `templateFields`, so `fieldCount` is 0 and
  // the guard's first line returns null. What it stops is a caller creating a
  // row named "Neclasificat" WITH a form, which is the only shape that matters.
  const createCatchAll = catchAllFormRefusal(
    null,
    {
      key,
      name: typeof data.name === "string" ? data.name : "",
      fieldCount: parseTemplateFields(values.templateFields).length,
    },
    (values as { templateFields?: unknown }).templateFields !== undefined,
  );
  if (createCatchAll !== null) throw new CatchAllFormRefusedError(createCatchAll);
  const [row] = await conn
    .insert(lookupDocumentType)
    .values({ ...values, key, origin })
    .returning();
  return row as LookupRow;
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
      // Two guards, composed. `stripDocumentTypeOrigin` keeps a rename from
      // re-originating an imported type (#26.12); `sanitizeDocumentType-
      // TemplateFields` keeps a hand-typed label out of the extraction
      // prompt and renumbers `order` from array position (#27.03). Both
      // named rather than inlined so each can be asserted on behaviour
      // without opening a database connection.
      const values = sanitizeDocumentTypeTemplateFields(stripDocumentTypeOrigin(data));
      // ── A third guard, and it is the one that reads the ROW. (#32.07) ────
      //
      // ⚠️ **THIS IS THE DOOR THE BAD ROW MOST LIKELY CAME THROUGH, AND BOTH
      // HALVES OF THE REFUSAL LIVE HERE.** The payload carries `name` and
      // `templateFields` together, so a guard on the fields alone would not
      // stop a type that already HAS a form being RENAMED into an identity
      // card — a lock on a door with the window open beside it.
      //
      // ⚠️ **The question is asked of the ROW THE WRITE WOULD LEAVE**, which is
      // why the stored row has to be read: `name` may be absent from the
      // payload (the form editor sends it, a `templateFields`-only caller may
      // not), and `templateFields` is absent on every plain rename, in which
      // case the form that decides is the one already stored.
      //
      // ⚠️ **AND `key` IS TAKEN FROM THE PAYLOAD WHERE THERE IS ONE, WHICH AN
      // ADVERSARIAL ROUND CORRECTED.** An earlier version of this comment said
      // `key` "is never in a PUT payload at all", which is true of the HTTP
      // route — `documentTypeUpdateSchema` strips it — and NOT true of this
      // function, which is `.set(values)` over whatever object it is handed and
      // `key` is a real column. That is the exact hole the guard was put in the
      // query layer to close: a direct caller sending
      // `{ key: "CARTE_IDENTITATE", templateFields: [...] }` would have been
      // judged against the STORED key, found ordinary, and allowed to write the
      // archive's identity-card key and a form together. Same class as the one
      // `stripDocumentTypeOrigin` exists for, on the second write-once column.
      //
      // ⚠️ **A read and then a write, not one statement, so it is not atomic.**
      // Two administrators — one adding a form, one renaming the same type into
      // an identity card, in the same instant — could still land the pair this
      // refuses. It is an admin screen on a single-user archive and the row is
      // repaired by the migration's own predicate; a `WHERE` that encoded
      // `isIdCardTypeName`'s Romanian folding in SQL would be a second opinion
      // about the rule, which is the shape this slice exists to remove.
      const [stored] = await db
        .select({
          key:            lookupDocumentType.key,
          name:           lookupDocumentType.name,
          templateFields: lookupDocumentType.templateFields,
        })
        .from(lookupDocumentType)
        .where(eq(lookupDocumentType.id, id))
        .limit(1);
      // No row is the caller's 404, decided below by the update returning
      // nothing. Refusing here would answer 400 for a type that does not exist.
      if (stored) {
        const nextFields = (values as { templateFields?: unknown }).templateFields;
        const refusal = idCardFormRefusal(
          {
            key:     stored.key,
            name:    stored.name,
            hasForm: documentTypeHasForm(stored.templateFields),
          },
          {
            key:  typeof values.key === "string" ? values.key : stored.key,
            name: typeof values.name === "string" ? values.name : stored.name,
            hasForm:
              nextFields === undefined
                ? documentTypeHasForm(stored.templateFields)
                : documentTypeHasForm(nextFields),
          },
          // ⚠️ **The term that keeps Reference Data's name-only edit form
          // usable on a row that is already wrong.** See `idCardFormRefusal`.
          nextFields !== undefined,
        );
        if (refusal !== null) throw new IdCardFormRefusedError(refusal);
        // ⚠️ **THE CATCH-ALL GUARD, ASKED OF THE SAME `stored` ROW.** (Slice
        // #32.19, finding S-02.) Same three arguments and the same reasoning
        // about each of them — the question is about the row the write would
        // LEAVE, `key` comes from the payload where there is one because
        // `.set(values)` is over whatever a direct caller hands it, and
        // `writesTheForm` is what keeps Reference Data's name-only edit form
        // usable on a row that already carries a form.
        //
        // ⚠️ **It counts FIELDS where the identity-card guard asks a yes/no**,
        // and that is the grandfather clause: a form already saved on the
        // catch-all stays readable, shrinkable and deletable through the form
        // editor, and a write that touches the column is allowed only if it
        // leaves FEWER fields than it found. (Not "only a growing write is
        // refused" — an adversarial round measured what that lets through: the
        // editor sends the whole set, so swapping four fields for four different
        // ones is 4 → 4.) Refusing every touch would strand the row instead —
        // the editor that could clear the form saves through this very function.
        const catchAll = catchAllFormRefusal(
          {
            key:        stored.key,
            name:       stored.name,
            fieldCount: parseTemplateFields(stored.templateFields).length,
          },
          {
            key:  typeof values.key === "string" ? values.key : stored.key,
            name: typeof values.name === "string" ? values.name : stored.name,
            fieldCount:
              nextFields === undefined
                ? parseTemplateFields(stored.templateFields).length
                : parseTemplateFields(nextFields).length,
          },
          nextFields !== undefined,
        );
        if (catchAll !== null) throw new CatchAllFormRefusedError(catchAll);
        // ── A fourth guard: two types may not share one display name. ──────
        //                                                       (Slice #34.09)
        //
        // ⚠️ **A GUARD ON THE CREATE DOOR ALONE WOULD BE THE LOCK-ON-A-DOOR-
        // WITH-THE-WINDOW-OPEN SHAPE THIS BRANCH HAS ALREADY BEEN CAUGHT BY
        // TWICE.** The identity-card and catch-all refusals above both had to
        // grow a rename half for exactly this reason. Reference Data's edit
        // form renames a type, and a rename onto a name another row holds is
        // the same two rows with the same one name, reached from the other
        // side.
        //
        // ⚠️ **IT ASKS WHETHER THE WRITE *CHANGES* THE NAME, NOT WHETHER THE
        // NAME COLLIDES — AND AN ADVERSARIAL ROUND IS WHY.** The first version
        // of this guard ran on any payload carrying a `name`, which read as
        // safe because "the admin edit form is the only thing that renames".
        // It is not: `document-type-form-editor.tsx` sends
        // `{ name: typeName, templateFields }` on EVERY form save — `name`
        // because the PUT is a full-row replace and its schema requires it —
        // so on a database that ALREADY holds two types with one name (which
        // is precisely the database migration_080 refuses to index, i.e. the
        // one running this code without the index behind it) pressing
        // „Formular" on either row and saving was refused, in English, by a
        // guard about a field that screen cannot edit. That strands the only
        // screen in the application that can CLEAR a form — the exact shape of
        // the grandfather clause `catch-all-form-guard.ts` exists for, one
        // door over, rebuilt.
        //
        // So the term is `normaliseDocumentTypeName(next) !== normalise(stored)`:
        // a write that leaves the name as it found it — byte for byte, or with
        // its diacritics, case or punctuation corrected — is not judged at all,
        // and a write that MOVES the name onto another row's is. Two names that
        // both normalise to nothing count as unchanged, which is right: the
        // partial index does not constrain them either.
        //
        // ⚠️ **`typeof values.name === "string"` stays**, so a payload that
        // does not state a name is not judged: `.set(values)` leaves an unnamed
        // column alone, so such a write cannot create a collision. Same term,
        // same reason, as `writesTheForm` above.
        //
        // ⚠️ **`id` is still passed as `exceptId`, and it is now belt and
        // braces rather than the only guard.** Without it a rename to a
        // different spelling of the row's OWN name would find itself among the
        // rows searched. The predicate above already excludes that case; the
        // argument is kept in place because a future edit to one of the two
        // should not silently remove the other.
        if (
          typeof values.name === "string" &&
          normaliseDocumentTypeName(values.name) !==
            normaliseDocumentTypeName(stored.name)
        ) {
          const others = await db
            .select({
              id:   lookupDocumentType.id,
              key:  lookupDocumentType.key,
              name: lookupDocumentType.name,
            })
            .from(lookupDocumentType);
          const takenBy = documentTypeNameTakenBy(values.name, others, id);
          if (takenBy !== null) throw new DocumentTypeNameTakenError(takenBy.name);
        }
      }
      const [row] = await db
        .update(lookupDocumentType)
        .set(values)
        .where(eq(lookupDocumentType.id, id))
        .returning();
      return (row as LookupRow) ?? null;
    }
    case "institutions": {
      const [row] = await db.update(lookupInstitution).set(data).where(eq(lookupInstitution.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "property-property-roles": {
      const [row] = await db.update(lookupPropertyPropertyRole).set(data).where(eq(lookupPropertyPropertyRole.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "document-document-roles": {
      const [row] = await db.update(lookupDocumentDocumentRole).set(data).where(eq(lookupDocumentDocumentRole.id, id)).returning();
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
// over that table, which is the point: the refusal is the same sentence for
// every list, and a NEW list is an entry there rather than a branch here.
// Slice #29.13 is the evidence: it added the tenth and the eleventh and this
// section did not change at all.

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
 * every statement takes its own snapshot — `person-roles`' four counts are
 * four snapshots inside the transaction exactly as they would be outside it.
 * Raising the level would buy consistency and a 40001 to handle, and it is not
 * where the guarantee is needed: what gates the DESTRUCTIVE step is the row
 * lock in `lookupRowId`, taken by `deleteValue` alone. The counting path is a
 * best-effort read, and a number that is one row stale between the dialog
 * opening and the button being pressed is caught by the delete's own recount
 * under that lock.
 */
type Conn = DbTransaction;

/**
 * The lookup row's id, confirming it exists — and optionally locking it.
 *
 * Returns `undefined` when the row does not exist.
 *
 * `lock` takes a row-level `FOR UPDATE`, and it is doing real work rather than
 * being defensive noise: Postgres' referential-integrity check takes a
 * `FOR KEY SHARE` on the parent row before allowing an insert that references
 * it, and `FOR KEY SHARE` conflicts with `FOR UPDATE`. So a document being
 * created while this transaction counts documents waits for it, and the count
 * cannot go stale between the count and the delete.
 *
 * ⚠️ **Slice #34.03 made that true of `tarla` as well**, and the caveat that
 * used to be here — "on `tarla` there is no foreign key, so the lock buys
 * nothing; a property saved with the same text mid-transaction is a race this
 * cannot close" — is deleted rather than reworded. It was true of a text
 * column and is false of `property.tarla_id`: the referential-integrity check
 * now takes the same `FOR KEY SHARE` on this row that it takes for the other
 * ten, so the eleventh list gets the same guarantee for the same reason.
 *
 * This was `sourceValue` and read `def.source`, which no longer exists — see
 * ./dependents.ts. It returns the id because that is the only thing a
 * dependent can carry now.
 */
async function lookupRowId(
  conn: Conn,
  def: ListDependencies,
  id: string,
  lock = false,
): Promise<string | undefined> {
  const q = conn.select({ v: def.idColumn }).from(def.table).where(eq(def.idColumn, id));
  const rows = lock ? await q.for("update") : await q;
  return rows.length > 0 ? (rows[0].v as string) : undefined;
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

// Slice #34.03: `siblingsSharingValue` was here. It counted the OTHER rows of
// a list carrying the same value, which was only ever non-zero on `tarla`,
// where nothing makes `indicativ` unique and the dependents were matched by
// TEXT: if another row still supplied "T1", the properties carrying "T1" lost
// nothing when this row went, so refusing the delete would have stranded the
// twin for ever — it could not be deleted, and could not be moved either,
// because moving onto an identical sibling rewrote nothing. migration_078
// makes a property point at a ROW, so a twin strands nothing and the whole
// dead end is gone. Nothing replaces it, and `lookup_tarla.indicativ` is still
// not unique — see that migration's header for why a unique index was
// deliberately not added.

async function buildReport(
  conn: Conn,
  list: ListKey,
  id: string,
  value: unknown,
): Promise<DependentsReport> {
  const def = LIST_DEPENDENCIES[list];
  const dependents: DependentCount[] = [];
  const removedWithRow: DependentCount[] = [];
  const notes = dependentNotes(list);

  // Slice #34.03: the `shared` branch that stood here is gone with
  // `siblingsSharingValue`. It suppressed the counts on `tarla` when another
  // row carried the same text, because then nothing DEPENDED on this row — the
  // value survived it. A property points at a row now, so a twin takes nothing
  // with it and there is no case to special-case.

  // Sequential rather than Promise.all: inside a transaction these share one
  // connection, and the ordering of the report is the map's order either way.
  for (const ref of def.refs) {
    const n = await countRef(conn, ref, value);
    if (ref.configuration) addCount(removedWithRow, ref.labelKey, n);
    else addCount(dependents, ref.labelKey, n);
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
    const value = await lookupRowId(tx, def, id);
    if (value === undefined) return null;
    return buildReport(tx, list, id, value);
  });
}

export type MovedRows = {
  /** How many rows the UPDATE rewrote. */
  count: number;
  /**
   * The versioned objects behind those rows.                    (Slice #29.14)
   *
   * Empty when the ref declares no `versioned` — the five association tables,
   * which carry no snapshot, no version table and no `updated_by`, so there is
   * nothing for the move to write about them. Otherwise one id per rewritten
   * row, which for all eight versioned refs today — eight refs over four
   * tables — is one per object.
   */
  ids: string[];
};

/**
 * Move the rows one ref covers from one value to another — how many, and which
 * objects they belong to.
 *
 * ⚠️ **Configuration refs never reach this function** — see `configuration` in
 * ./dependents.ts. An adversarial round found what the first draft did with
 * them: `lookup_property_person_role` was UNIQUE on the role, so "moving" a
 * whitelist tick onto a role that already had one deleted a row and updated
 * nothing, and the dialog then reported "nothing was moved" immediately after
 * destroying a row. They are not objects that can be re-pointed; they are the
 * row's own settings, and they go with it. (That particular table is gone —
 * Slice #34.04 made it a boolean on `lookup_person_role`, which is the same
 * conclusion arrived at from the other end. The argument still holds for
 * `lookup_doc_type_person_role`, which is unique over the PAIR and stays.)
 */
async function moveRef(
  tx: DbTransaction,
  ref: DependentRef,
  from: unknown,
  to: unknown,
): Promise<MovedRows> {
  const table  = sql.identifier(getTableName(ref.table));
  const column = sql.identifier(ref.column.name);
  const versioned = ref.versioned;

  // Raw SQL rather than the query builder because `ref.table` is a generic
  // `PgTable` here: `.set()` on one has no column types to check against, so
  // the builder would buy nothing that `sql.identifier` does not. The column
  // name comes from the schema object either way — there is no string literal
  // to mistype. `${column}` is deliberately UNQUALIFIED: a `SET "t"."c" = …`
  // is a syntax error in Postgres.
  //
  // Slice #29.14: `RETURNING` names the versioned object's id column rather
  // than the constant `1` it used to, because the rows this rewrote are the
  // rows whose history the move now has to write, and the UPDATE is the only
  // place that knows which they were — a second SELECT afterwards would look
  // for the SOURCE value that no longer exists.
  const returning = versioned ? sql.identifier(versioned.idColumn.name) : sql`1`;
  const moved = await tx.execute(
    sql`UPDATE ${table} SET ${column} = ${to} WHERE ${column} = ${from} RETURNING ${returning}`,
  );

  const rows = moved.rows as Array<Record<string, unknown>>;
  return {
    count: rows.length,
    ids: versioned
      ? rows.map((r) => String(r[versioned.idColumn.name]))
      : [],
  };
}

export type ReassignOutcome =
  | {
      ok: true;
      moved: DependentCount[];
      total: number;
      /**
       * Whitelist ticks the TARGET gained so the moved rows stay selectable.
       * Empty on every list but `person-roles`, and empty there too when the
       * target was already ticked wherever the moved rows needed it.
       *                                                        (Slice #29.13)
       */
      granted: DependentCount[];
      /**
       * i18n keys under `valueList.confirm` — repairs the grant could NOT
       * make. Today one: `roleWhitelistPending`, when the target role ends up
       * ticked for no document type at all and nothing safe can change that.
       * See ./role-whitelists.ts.
       */
      warnings: string[];
      /**
       * Version rows the move wrote.                            (Slice #29.14)
       *
       * At most `total`, and legitimately fewer: an object whose snapshot did
       * not change gets no version, and the five unversioned association
       * tables (see `UNVERSIONED_MOVE_TABLES` in ./dependents.ts) never get
       * one at all — so a `person-roles` move that re-points nine hundred role
       * tags reports `total: 900, versions: 0`, which is the honest answer and
       * not a failure.
       *
       * Reported here rather than only counted, because "900 moved" and "900
       * recorded" are different facts and the screen currently says only the
       * first. Putting the second in front of the user is a follow-up on the
       * dialog, named in the handover; the number is carried from here so that
       * change never has to touch this file.
       */
      versions: number;
    }
  | { ok: false; reason: "not-found" | "same-value" };

/**
 * Slice #29.13 made it whitelist-aware: a `person-roles` move now grants the
 * target the ticks the moved associations need in order to stay selectable —
 * only where rows really moved, never for a bare tick. See
 * ./role-whitelists.ts, and `valueList.confirm.roleWhitelistNote`, which was
 * the sentence that stood in for this and is deleted in the same commit.
 *
 * Slice #29.14 made it record itself. Every rewritten object gets its
 * `updated_by` stamped from the acting session and, where a fresh snapshot
 * really differs from the latest stored one, a version row — written by the
 * entity's OWN comparison, not a copy of it (see ./move-history.ts, and
 * `recordPropertyVersionIfChanged` and its three siblings). Before that, the
 * move wrote neither, so the type change surfaced in the NEXT ordinary edit's
 * diff under whoever made that edit, while the row's `updated_by` kept the
 * previous writer and the `touch_updated_at` trigger moved `updated_at` — a
 * row reading "changed just now, by someone who did not change it".
 *
 * ⚠️ **THE HISTORY IS WRITTEN INSIDE THIS TRANSACTION, and that is not
 * incidental.** Both lookup rows are locked here and the UPDATEs are here; a
 * version written after the commit would be a history that a rollback leaves
 * disagreeing with its own rows, and a crash between the two would leave it
 * missing altogether.
 *
 * ⚠️ **THE ACTING USER IS RESOLVED, AND A MISSING ONE REFUSES THE MOVE.** An
 * adversarial round showed why the first version — `getCurrentUserEmail()`,
 * whose null means "UAT, or the Auth API just failed, and there is no telling
 * which" — was not good enough. `getCurrentUser()` catches everything and
 * returns null on any Supabase fault, so a blip between the route's own auth
 * check and this line would have stamped `updated_by = NULL` across every row
 * the move touched: "changed just now, by nobody", which is the same defect
 * this slice exists to close, differently spelled, and unrecoverable because
 * the previous author is gone. So the IDENTITY is resolved, not the address,
 * and a null identity throws rather than writes. A null EMAIL still passes,
 * because it means the synthetic UAT user — the one box where an ordinary edit
 * writes null too.
 *
 * `actor` exists for callers that already know who is acting: tests, and the
 * route, which holds a `CurrentUser` already and should hand it down rather
 * than pay a second round trip for it (see `getCurrentUserIdAndRole` in
 * @/lib/auth/current-role for the round that made resolving-once a rule). That
 * is a follow-up on the route, named in the handover; until then this resolves
 * it, and refuses rather than guesses.
 */
export async function reassignDependents(
  list: ListKey,
  fromId: string,
  toId: string,
  actor?: string | null,
): Promise<ReassignOutcome> {
  if (fromId === toId) return { ok: false, reason: "same-value" };
  const def = LIST_DEPENDENCIES[list];

  // Resolved BEFORE the transaction opens. `getCurrentUser()` reads the
  // request's cookies and, outside UAT mode, asks Supabase — network work that
  // has no business happening while two lookup rows are locked.
  let updatedBy: string | null;
  if (actor === undefined) {
    const acting = await getCurrentUser();
    // Not a guard against an unauthenticated caller — middleware and the route
    // do that. It is the difference between "UAT, whose email is null by
    // design" and "the Auth API failed", which `getCurrentUserEmail()` reports
    // identically. Throwing rolls the move back whole; writing null would
    // rewrite every moved row's author to nobody.
    if (acting === null) {
      throw new Error(
        "reassignDependents: no acting user — refusing to re-point rows with no author",
      );
    }
    updatedBy = acting.email;
  } else {
    updatedBy = actor;
  }

  return db.transaction(async (tx) => {
    // Both rows locked, in id order. The order is what keeps two
    // administrators moving values at each other from deadlocking; the lock
    // itself is what stops a new dependent arriving between the move and the
    // delete that follows it (see `lookupRowId`).
    const [firstId, secondId] = fromId < toId ? [fromId, toId] : [toId, fromId];
    await lookupRowId(tx, def, firstId, true);
    await lookupRowId(tx, def, secondId, true);

    const from = await lookupRowId(tx, def, fromId);
    const to   = await lookupRowId(tx, def, toId);
    if (from === undefined || to === undefined) {
      return { ok: false, reason: "not-found" } as const;
    }
    // Both ids exist and are different rows. Since Slice #34.03 this can only
    // fire when `fromId === toId`, because the values compared ARE the ids; on
    // a value-matched list it used to catch two `tarla` rows carrying the same
    // indicativ, where moving one onto the other rewrote nothing while
    // reporting a move.
    if (from === to) return { ok: false, reason: "same-value" } as const;

    // Slice #34.03: the `ambiguous-value` refusal stood here. A row whose twin
    // carried the same text could not be moved at all — the properties
    // carrying "T1" belonged to BOTH rows equally, nothing in the data said
    // which, and rewriting them would silently take the twin's properties too.
    // A property points at a ROW now, so "which of the two does this belong
    // to" has an answer and the refusal has nothing to refuse.

    // ⚠️ **BEFORE the move, and that is not an implementation detail.**
    // `grantWhitelists` decides what to grant by asking whether any rows still
    // carry the SOURCE value; after the UPDATE they carry the target's, mixed
    // in with rows that were already there, and the question stops being
    // answerable. It runs on this transaction, so a move that rolls back takes
    // its grants with it.                                       (Slice #29.13)
    //
    // The `typeof` guard is what keeps this honest on a value-matched list: on
    // `tarla` the values are text, not ids, and no whitelist exists — the
    // clause below is simply not entered, because `tarla` declares no
    // `grantWhitelists`. It is written as a narrowing rather than a cast so a
    // future value-matched list that DOES declare one cannot silently pass a
    // non-uuid into an insert.
    const whitelists =
      def.grantWhitelists && typeof from === "string" && typeof to === "string"
        ? await def.grantWhitelists(tx, from, to)
        : { granted: [], warnings: [] };

    const moved: DependentCount[] = [];
    let versions = 0;
    for (const ref of def.refs) {
      // Configuration goes with the row when it is deleted; it is not moved —
      // so it never reaches `recordMoveHistory` either, which is correct: a
      // version of a whitelist tick would record something that never
      // happened.
      if (ref.configuration) continue;
      const rewritten = await moveRef(tx, ref, from, to);
      addCount(moved, ref.labelKey, rewritten.count);
      // Slice #29.14: the same transaction, deliberately. `rewritten.ids` is
      // empty for the five unversioned association tables, and this is a no-op
      // for them.
      versions += await recordMoveHistory(tx, ref, rewritten.ids, updatedBy);
    }
    return {
      ok: true,
      moved,
      total: moved.reduce((sum, d) => sum + d.count, 0),
      granted:  whitelists.granted,
      warnings: whitelists.warnings,
      versions,
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
// Slice #29.05: and it is refused while anything depends on it — for all
// eleven lists (nine when #29.05 shipped; #29.13 brought the two
// relationship-role lists in), in application code, because the database only
// refuses on one of the sixteen edges that reach them. The nine-way switch this function was is
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
    const value = await lookupRowId(tx, def, id, true);
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
