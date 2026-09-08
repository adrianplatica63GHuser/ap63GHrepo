/**
 * Two document types may not share one display name — ON THE SERVER.
 *                                                                (Slice #34.09)
 *
 * WHY THIS EXISTS
 * ---------------
 * ⚠️ **THE CREATE DOOR PERFORMS NO NAME CHECK AT ALL, AND ONLY THE CLIENT
 * STOPS A DUPLICATE.** `createValue`'s document-types branch says so in as many
 * words (`src/lib/admin/value-lists/queries.ts`): the duplicate-name refusal
 * lives in the discovery review dialog's `sameTypeName`, against a react-query
 * list that may be five minutes old. So a second type with one display name is
 * reachable through a STALE LIST rather than through a race — and the advisory
 * lock `resolveClassifiedDocumentType` takes cannot serialise against a check
 * that is not being made. #29.06 wrote that sentence and put the fix in its
 * handover as "a unique index on the normalised name, which needs a migration".
 *
 * This module is the half of that fix an administrator can read.
 * `migration_080_document_type_name_unique.sql` is the other half, and neither
 * replaces the other:
 *
 *   • The INDEX is what makes the rule true of the database — of a direct
 *     caller, of a script, of `psql`, and of the race this module cannot close,
 *     because a read and then a write is not atomic.
 *   • THIS is what turns the refusal into a sentence. A 23505 reaching
 *     `dbErrorToResponse` carries only `error` and `constraint`, which
 *     `failureFromResponse` maps to the generic Romanian "the operation did not
 *     succeed — close the window, refresh the page and try again". That is
 *     useless advice for a name the archive already holds, and it is the exact
 *     failure `src/lib/admin/value-lists/failures.ts` exists to stop.
 *
 * WHICH DOORS IT SITS ON — BOTH, AND THE RENAME IS NOT THE EXTRA
 * -------------------------------------------------------------
 * `createDocumentTypeRow` and the `document-types` branch of `updateValue`.
 *
 * ⚠️ **A guard on CREATE alone would be the lock-on-a-door-with-the-window-open
 * shape this file's neighbours keep finding.** Reference Data's edit form
 * renames a type, and a rename onto a name another row already holds is the
 * same two rows with the same one name, arrived at from the other side. It is
 * also the case that would otherwise reach a user as a raw 23505: until this
 * slice the value-lists PUT route deliberately did NOT map Postgres errors, on
 * the stated reasoning that "across all eleven lists the only UNIQUE
 * constraints are on `key`" — which migration_080 makes false.
 *
 * WHY THE EMPTY NORMALISED FORM IS NOT A COLLISION
 * ------------------------------------------------
 * `sameDocumentTypeName` answers `false` for two empty normalised forms,
 * deliberately: a name of „—" or of a single space normalises to the empty
 * string, and treating those as equal would let one punctuation-only type
 * absorb every other one. This module asks that function and inherits the
 * exception rather than restating it, and migration_080's index is PARTIAL for
 * the same reason. A punctuation-only name stays creatable exactly as it is
 * today.
 *
 * WHY IT IS A REFUSAL AND NOT A SILENT RENAME
 * -------------------------------------------
 * Same answer as `id-card-form-guard.ts` and `catch-all-form-guard.ts` one
 * door over: a create that quietly appended " (2)" would report a save that
 * wrote something the user did not type. The write answers 400 with a named
 * `code` and the screens say it in Romanian.
 *
 * Pure module — no DB, no React, no next/*. Unit-tested in
 * src/__tests__/document-type-name-unique.test.ts.
 */

import {
  documentTypeIsCatchAll,
  sameDocumentTypeName,
} from "@/lib/documents/document-type-match";
import { documentTypeIsIdCard } from "@/lib/import/id-card";
import { requestedDocumentTypeKey } from "@/lib/admin/value-lists/keys";

/**
 * The `code` the refusal travels under.
 *
 * snake_case, matching `ID_CARD_FORM_CODE` / `CATCH_ALL_FORM_CODE` rather than
 * the value-lists module's SCREAMING_CASE, for the reason stated there: this
 * refusal crosses the same two doors those do, and one refusal spelled two ways
 * on two wires is what those constants exist to stop.
 */
export const DOCUMENT_TYPE_NAME_TAKEN_CODE = "document_type_name_taken";

/**
 * The refusal for the OTHER thing #34.09 lets a person type: a `key` that some
 * row already holds.
 *
 * ⚠️ **It is not raised from this module.** `createDocumentTypeRow` already
 * refuses a preferred key it cannot have — `PREFERRED_KEY_TAKEN`, Slice #29.07,
 * written so `resolveClassifiedDocumentType` could go round and adopt rather
 * than commit a `_2` row. Now that a PERSON can express a key, that same
 * sentinel is also a thing to say out loud, so the constant lives beside the
 * name one and the two routes map both. Keeping it here rather than in
 * `queries.ts` is what lets `failures.ts` and the tests reach it without
 * opening a `pg.Pool` at module load.
 */
export const DOCUMENT_TYPE_KEY_TAKEN_CODE = "document_type_key_taken";

/**
 * The index migration_080 creates.
 *
 * ⚠️ **Exported so the two routes can recognise the 23505 by CONSTRAINT rather
 * than by guessing.** `dbErrorToResponse`'s existing 23505 branch tests
 * `e.constraint?.includes("cnp")` / `("cui")` — a substring test that would
 * answer nothing useful here — and its fallback body carries no `code` at all.
 * The race this names is the one the read-then-write refusal above cannot
 * close, so it has to arrive as the same sentence rather than as the generic
 * one. Renaming the index in the migration without changing this constant
 * silently puts that race back on the generic sentence, which is why
 * `document-type-name-unique.test.ts` reads the migration file and asserts the
 * two agree.
 */
export const DOCUMENT_TYPE_NAME_UNIQUE_INDEX =
  "lookup_document_type_name_normalised_unique";

/**
 * The two other things a person can now type into the key field that the
 * archive must not accept.                                       (Slice #34.09)
 */
export const DOCUMENT_TYPE_KEY_INVALID_CODE  = "document_type_key_invalid";
export const DOCUMENT_TYPE_KEY_RESERVED_CODE = "document_type_key_reserved";

/**
 * How long a key a PERSON TYPED may be.
 *
 * ⚠️ **Not a ceiling on the column, and the distinction is worth one line.**
 * `documentTypeSchema.name` has no `.max()`, so a key derived from a very long
 * NAME can still exceed this; nothing checks that and nothing needs to, because
 * a name that long is its own problem and is visible on the screen. This bounds
 * the one field whose value is invisible after creation.
 *
 * ⚠️ **MEASURED ON THE SLUG, NOT ON THE TYPED TEXT, AND A ROUND CORRECTED THE
 * OTHER WAY ROUND.** `slugifyLookupKey` uppercases, and uppercasing can
 * LENGTHEN — „ß" becomes „SS" — so a 64-character ceiling on the input is not a
 * 64-character ceiling on the column. Nothing depends on the number; it is here
 * so the field cannot be used to post a novel, and it is checked where every
 * other thing about the key is checked so there is one refusal to say.
 */
export const MAX_DOCUMENT_TYPE_KEY_LENGTH = 64;

/**
 * Why a key a person typed cannot be used.
 *
 *  - `invalid`  — it slugs to nothing („—", „!!!", a single space), or the slug
 *                 is longer than the archive allows. There is no honest key to
 *                 store; `slugifyLookupKey` would answer the shared fallback
 *                 `DOCTYPE`, which is a permanent immutable key nobody chose.
 *  - `reserved` — the slug is one the codebase itself matches on, and the NAME
 *                 does not agree with it.
 */
export type DocumentTypeKeyRefusal = "invalid" | "reserved";

export function documentTypeKeyRefusalCode(refusal: DocumentTypeKeyRefusal): string {
  return refusal === "reserved"
    ? DOCUMENT_TYPE_KEY_RESERVED_CODE
    : DOCUMENT_TYPE_KEY_INVALID_CODE;
}

/**
 * May this person have this key for a type with this name?
 *                                                                (Slice #34.09)
 *
 * ⚠️ **THE `reserved` ARM IS A HOLE THIS SLICE OPENED AND AN ADVERSARIAL ROUND
 * FOUND, AND IT IS WORTH STATING EXACTLY.** Before #34.09 a document type's key
 * was ALWAYS the slug of its name, so a row could only end up keyed
 * `NECLASIFICAT` or `CARTE_IDENTITATE` by being NAMED something that slugs to
 * one of those — and both of those names are themselves recognised by the same
 * guards. `requestedDocumentTypeKey` severs that: the key and the name became
 * independent, and nothing else noticed.
 *
 * The measured sequence: POST `{ name: "Contract de Vânzare", key:
 * "NECLASIFICAT" }`. No stored row holds the KEY `NECLASIFICAT` — the catch-all
 * is keyed `UNCLASSIFIED` and merely NAMED „NECLASIFICAT" — so
 * `PREFERRED_KEY_TAKEN` does not fire; the two create-time guards beside this
 * one are both inert, because each returns `null` on its first line when the
 * write carries no form and the Reference Data form never sends one. The row is
 * created, and from that moment `documentTypeIsCatchAll` answers true for it:
 * the list hides its Form button and the form editor refuses a form on it, with
 * a Romanian sentence about the unclassified catch-all, on a row named „Contract
 * de Vânzare". The same shape reaches `CARTE_IDENTITATE` on any database where
 * that row is absent — a freshly reset cloud project, for one.
 *
 * ⚠️ **"UNLESS THE NAME AGREES" RATHER THAN A FLAT BAN**, because the archive
 * legitimately needs those rows: `migration_072` seeds the catch-all and #29.07
 * exists so an identity-card type can be minted under its canonical key. What
 * must not happen is a row whose KEY says one thing and whose NAME says
 * another, because every carve-out in the codebase matches one or the other and
 * they would then disagree about the same row. So the test is asymmetric on
 * purpose: reserved by key, not reserved by name.
 *
 * ⚠️ **It asks the same two predicates the guards beside it ask** —
 * `documentTypeIsCatchAll` and `documentTypeIsIdCard` — each twice, once with
 * the name blanked and once with the key blanked, so there is no third opinion
 * about what a reserved key or a reserved name is. Both are safe on a blank
 * input: `meansUnclassified("")` and `isIdCardTypeName("")` are false, because
 * `sameDocumentTypeName` refuses an empty normalised form and the id-card
 * predicate requires a non-empty fold.
 *
 * ⚠️ **An absent key is not a refusal.** `undefined`, `null` and a blank string
 * all mean "did not ask", and `createDocumentTypeRow` then slugs the name
 * exactly as it did before this slice.
 */
export function documentTypeKeyRefusal(
  raw: unknown,
  name: unknown,
): DocumentTypeKeyRefusal | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const slug = requestedDocumentTypeKey(raw);
  if (slug === null) return "invalid";
  if (slug.length > MAX_DOCUMENT_TYPE_KEY_LENGTH) return "invalid";
  const statedName = typeof name === "string" ? name : "";
  const byKey  = { key: slug, name: "" };
  const byName = { key: "",   name: statedName };
  if (documentTypeIsCatchAll(byKey) && !documentTypeIsCatchAll(byName)) return "reserved";
  if (documentTypeIsIdCard(byKey)  && !documentTypeIsIdCard(byName))  return "reserved";
  return null;
}

/** Thrown by `createValue`, mapped to a named 400 by the value-lists POST. */
export class DocumentTypeKeyRefusedError extends Error {
  constructor(readonly refusal: DocumentTypeKeyRefusal) {
    super(documentTypeKeyRefusalCode(refusal));
    this.name = "DocumentTypeKeyRefusedError";
  }
}

export function asDocumentTypeKeyRefused(
  err: unknown,
): DocumentTypeKeyRefusedError | null {
  return err instanceof DocumentTypeKeyRefusedError ? err : null;
}

/** The little of a row this question needs. */
export type DocumentTypeNamed = {
  id?:   string | null;
  key?:  unknown;
  name?: unknown;
};

/**
 * The row that already holds this display name, or `null`.
 *
 * `exceptId` is the row being renamed — a PUT that leaves the name alone, or
 * changes only its punctuation, must not refuse itself. Omit it on a create.
 *
 * ⚠️ **The comparison is `sameDocumentTypeName`, never a `===` on the raw
 * text.** That is the whole point: „Contract de Vânzare", „contract de
 * vanzare" and „CONTRACT-DE-VANZARE" are one name to a business user, and the
 * database is about to say so too. It is also where the empty-form exception
 * comes from, so this function and migration_080's `WHERE` clause cannot
 * disagree about a punctuation-only name.
 *
 * ⚠️ **It answers with the ROW rather than with a boolean** so a caller can
 * name it — which is what makes the difference between "this name already
 * exists" and a sentence a person can act on. Nothing renders the row today;
 * the two routes carry it in the body's `error` for the English wire, and the
 * Romanian sentence on the screen is generic by construction (see
 * `failures.ts`). Returning it costs nothing and is the shape the next screen
 * that wants to say „este deja folosită de <X>" will need.
 */
export function documentTypeNameTakenBy<T extends DocumentTypeNamed>(
  name: unknown,
  rows: readonly T[],
  exceptId?: string | null,
): T | null {
  if (typeof name !== "string") return null;
  for (const row of rows) {
    if (exceptId != null && row.id === exceptId) continue;
    if (typeof row.name !== "string") continue;
    if (sameDocumentTypeName(name, row.name)) return row;
  }
  return null;
}

/**
 * Thrown by the query layer, mapped to a named 400 by both routes.
 *
 * A class rather than a sentinel message — unlike `PREFERRED_KEY_TAKEN`, which
 * is a sentinel because its one interested caller is inside the same module.
 * This one crosses two routes and a test, and it carries the colliding row's
 * name, which a message cannot.
 */
export class DocumentTypeNameTakenError extends Error {
  constructor(readonly takenBy: string) {
    super(DOCUMENT_TYPE_NAME_TAKEN_CODE);
    this.name = "DocumentTypeNameTakenError";
  }
}

/** The error, if that is what this is. Shape copied from `asIdCardFormRefusal`. */
export function asDocumentTypeNameTaken(
  err: unknown,
): DocumentTypeNameTakenError | null {
  return err instanceof DocumentTypeNameTakenError ? err : null;
}
