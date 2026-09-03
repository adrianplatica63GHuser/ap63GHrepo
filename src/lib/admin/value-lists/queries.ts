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
  lookupPropertyPropertyRole,
  lookupDocumentDocumentRole,
} from "@/db/schema";
import type { ListKey } from "./config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordMoveHistory } from "./move-history";
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
  documentTypeHasForm,
  isDocumentTypeOrigin,
  type DocumentTypeOrigin,
} from "@/lib/documents/status";
import {
  IdCardFormRefusedError,
  idCardFormRefusal,
} from "@/lib/documents/id-card-form-guard";
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
  table: typeof lookupDocumentType | typeof lookupPropertyType,
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
      // ⚠️ **And a lock here would not close the gap either**, which is why one
      // is deliberately not taken: this door performs no name check at all. Its
      // duplicate-name refusal lives in the CLIENT (`sameTypeName` in the
      // discovery review dialog, against a list react-query may have held for
      // five minutes), so two rows with one display name are reachable through
      // it by a stale list rather than by a race — and a lock cannot serialise
      // against a check that is not being made. The fix is a unique index on
      // the normalised name, which needs a migration; it is in the handover.
      return db.transaction((tx) => createDocumentTypeRow(tx, data));
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
  // Slice #29.07: the canonical key, when the classifier offered one this
  // codebase defines.
  //
  // ⚠️ **A PARAMETER OF ITS OWN, NEVER A FIELD ON `data`, AND THE DISTINCTION
  // IS THE WHOLE SAFETY ARGUMENT.** `key` is immutable and UNIQUE, and a client
  // that chose one would eventually choose a collision — so the two doors that
  // are a PERSON (the Reference Data form and the discovery review dialog) call
  // this with two arguments and cannot express a key at all, whatever their
  // request body happens to contain. Exactly one caller passes a third:
  // `resolveClassifiedDocumentType`, which gets it from `canonicalTypeKey` —
  // i.e. from `KNOWN_DOCUMENT_TYPES`, not from the wire. Same shape as `origin`
  // above, and for the same reason.
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
  // the create form is built from LIST_META, which lists `name` alone —
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
  // unreachable — `lookup_tarla.indicativ` is NOT NULL and the other ten
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
  | { ok: false; reason: "not-found" | "same-value" | "ambiguous-value" };

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
