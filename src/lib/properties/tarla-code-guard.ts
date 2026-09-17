/**
 * Two tarla codes may not fold to one code — ON THE SERVER.     (Slice #34.32)
 *
 * WHY THIS EXISTS
 * ---------------
 * ⚠️ **REFERENCE DATA'S „ADAUGĂ" MINTS TWINS WITH NO FOLD AND NO LOCK, AND HAS
 * SINCE THE LIST EXISTED.** #34.14's handover says it in as many words: „t3
 * beside T3. Older than this slice; the unique index migration_078 declines is
 * the real fix." `createValue`'s `tarla` branch was a bare
 * `db.insert(lookupTarla).values(data)` — no name check of any kind, on either
 * door — so an administrator typing `t3` where `T3` exists made the pair with
 * no race involved at all.
 *
 * That pair is not cosmetic. `property.tarla_id` has been a foreign key at
 * `lookup_tarla` since migration_078, so two rows that mean one tarla are two
 * populations of properties that no count, move or delete in Reference Data
 * can reconcile — and migration_078 section 3 REFUSES to resolve such a pair
 * rather than guessing, which leaves the archive holding something no
 * migration will fix for it.
 *
 * This module is the half an administrator can read.
 * `migration_083_tarla_code_unique.sql` is the other half, and neither
 * replaces the other:
 *
 *   • The INDEX is what makes the rule true of the database — of a direct
 *     caller, of a script, of `psql`, and of any future writer that does not
 *     take the locks below. (⚠️ It used to read "and of the race this module
 *     cannot close, because a read and then a write is not atomic". The read
 *     and the write ARE atomic now, under the locks `tarlaLockIdentities`
 *     hands out — see its header and `writeTarlaRow`. What the index still
 *     buys is everything that never calls this module at all.)
 *   • THIS is what turns the refusal into a sentence. A 23505 reaching
 *     `dbErrorToResponse` carries only `error` and `constraint`, which
 *     `failureFromResponse` maps to the generic Romanian "the operation did
 *     not succeed — close the window, refresh the page and try again". That is
 *     useless advice for a code the archive already holds, and it is the exact
 *     failure `src/lib/admin/value-lists/failures.ts` exists to stop.
 *
 * WHICH DOORS IT SITS ON — BOTH, FOR `document-type-name-guard.ts`'s REASON
 * ------------------------------------------------------------------------
 * The `tarla` branches of `createValue` AND of `updateValue`. A guard on
 * CREATE alone is the lock-on-a-door-with-the-window-open shape this file's
 * neighbour describes: Reference Data's edit form renames a code, and renaming
 * `T4` to `t3` where `T3` exists is the same two rows with the same one code,
 * arrived at from the other side.
 *
 * ⚠️ **THE THIRD WRITER IS NOT GUARDED HERE, AND THAT IS DELIBERATE.**
 * `resolveTarlaForCreate` (src/lib/properties/queries.ts) is the import's
 * auto-seed, and it must ADOPT rather than refuse: an import that stopped
 * because a folder said `t3` and the list said `T3` would be an import failing
 * on a spelling. It already adopts, under `cadastralKey`, and Slice #34.32
 * widens that to adopt under THIS fold too so it can never reach the index
 * with a row the index would reject. See that function's header.
 *
 * WHICH FOLD, AND WHY IT IS NOT THE DOCUMENT-TYPE ONE
 * ---------------------------------------------------
 * `foldRomanian` (src/lib/import/id-card.ts): NFD-decompose, strip the
 * combining marks, lowercase, collapse whitespace, trim. It is `pg_temp.
 * ga40_fold` in `scripts/decision-checks.sql`, which is the fold query 1c
 * measured this table under and the fold migration_078 resolves
 * `property.tarla_sola` with, so migration_083's index and this module cannot
 * disagree about a pair.
 *
 * ⚠️ **NOT `normaliseDocumentTypeName`**, one guard over, which additionally
 * drops everything outside `[a-z0-9]`. A tarla code is `47/2`, `48-50d`,
 * `99/9`; stripping the separators would make `47/2` and `472` one code and
 * refuse the second, which is two codes to everybody who reads a deed.
 *
 * ⚠️ **AND NOT `cadastralKey` EITHER**, which the import matches with. That
 * one additionally applies `perToSlash` and removes ALL whitespace, so it
 * equates `47per2` with `47/2` and `48 50` with `4850`. It is right for a
 * function that must CHOOSE and wrong for one that must REFUSE: refusing
 * `47 per 2` because `47/2` exists would refuse a code that reads differently
 * to a person, on a form where the remedy is not obvious. Looser where the
 * answer is "adopt", stricter where the answer is "no".
 *
 * WHY THE EMPTY FOLDED FORM IS NOT A COLLISION
 * --------------------------------------------
 * `tarlaSchema` is `indicativ: z.string().min(1)`, so a single space is a
 * valid payload and folds to nothing. Treating two empty folds as equal would
 * let ONE whitespace-only row absorb every other one — the same argument
 * `sameDocumentTypeName` makes about a punctuation-only name — so
 * `sameTarlaCode` answers `false` for them and migration_083's index is
 * PARTIAL for the same reason.
 *
 * ⚠️ **NOTE HOW SMALL THAT EXCEPTION IS HERE.** This fold does not strip
 * punctuation, so a code of „—" folds to „—" and IS compared; only whitespace
 * folds away. The document-type guard's exception covers every
 * punctuation-only name; this one covers whitespace alone.
 *
 * WHY IT IS A REFUSAL AND NOT A SILENT ADOPTION
 * ---------------------------------------------
 * On this door a person is typing a code they believe is new. Quietly handing
 * back the existing row would report a create that created nothing, and the
 * two rows a person meant to keep apart — `47/2` and `47 / 2`, say — would
 * silently become one. The import adopts because a machine has no intent to
 * misreport; a person gets told, and the sentence names the row that holds it.
 *
 * Pure module — no DB, no React, no next/*. Unit-tested in
 * src/__tests__/tarla-code-unique.test.ts.
 */

import { foldRomanian } from "@/lib/import/id-card";
import { cadastralKey } from "./cadastral-identity";

/**
 * The `code` the refusal travels under.
 *
 * snake_case, matching `DOCUMENT_TYPE_NAME_TAKEN_CODE` and the two form
 * guards, for the reason stated there: this refusal crosses the same two doors
 * those do, and one refusal spelled two ways on two wires is what those
 * constants exist to stop.
 */
export const TARLA_CODE_TAKEN_CODE = "tarla_code_taken";

/**
 * The index migration_083 creates.
 *
 * ⚠️ **Exported so the two routes can recognise the 23505 by CONSTRAINT rather
 * than by guessing.** `dbErrorToResponse`'s existing 23505 branch tests
 * `e.constraint?.includes("cnp")` / `("cui")` — a substring test that would
 * answer nothing useful here — and its fallback body carries no `code` at all.
 * The race this names is the one the read-then-write refusal below cannot
 * close, so it has to arrive as the same sentence rather than as the generic
 * one. Renaming the index in the migration without changing this constant
 * silently puts that race back on the generic sentence, which is why
 * `tarla-code-unique.test.ts` reads the migration file and asserts the two
 * agree.
 */
export const TARLA_CODE_UNIQUE_INDEX = "lookup_tarla_indicativ_folded_unique";

/**
 * Are these two tarla codes the same code?
 *
 * ⚠️ **Two empty folds are NOT equal**, deliberately — see the header. The
 * asymmetry is the whole of the difference between this function and a
 * `foldRomanian(a) === foldRomanian(b)`, and it is the reason migration_083's
 * index carries a `WHERE`.
 */
export function sameTarlaCode(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const folded = foldRomanian(a);
  if (folded === "") return false;
  return folded === foldRomanian(b);
}

/** The little of a row this question needs. */
export type TarlaCoded = {
  id?:        string | null;
  indicativ?: unknown;
};

/**
 * The row that already holds this code, or `null`.
 *
 * `exceptId` is the row being renamed — a PUT that leaves the code alone, or
 * changes only its spacing, must not refuse itself. Omit it on a create.
 *
 * ⚠️ **It answers with the ROW rather than with a boolean** so a caller can
 * name it, which is what makes the difference between "this code already
 * exists" and a sentence a person can act on. Unlike
 * `documentTypeNameTakenBy`, whose returned row nothing renders, this one IS
 * rendered: `valueList.confirm.errors.tarlaCodeTaken` names the existing
 * spelling, because on this list the two spellings differ by exactly the
 * thing the person cannot see (`t3` against `T3`) and a sentence that did not
 * show them both would read as a refusal of a code that is plainly not in the
 * list.
 */
export function tarlaCodeTakenBy<T extends TarlaCoded>(
  code: unknown,
  rows: readonly T[],
  exceptId?: string | null,
): T | null {
  if (typeof code !== "string") return null;
  for (const row of rows) {
    if (exceptId != null && row.id === exceptId) continue;
    if (sameTarlaCode(code, row.indicativ)) return row;
  }
  return null;
}

/**
 * Thrown by the query layer, mapped to a named 400 by both routes.
 *
 * A class rather than a sentinel message, for `DocumentTypeNameTakenError`'s
 * reason: it crosses two routes and a test, and it carries the colliding row's
 * code, which a message cannot.
 */
export class TarlaCodeTakenError extends Error {
  constructor(readonly takenBy: string) {
    super(TARLA_CODE_TAKEN_CODE);
    this.name = "TarlaCodeTakenError";
  }
}

/** The error, if that is what this is. Shape copied from `asDocumentTypeNameTaken`. */
export function asTarlaCodeTaken(err: unknown): TarlaCodeTakenError | null {
  return err instanceof TarlaCodeTakenError ? err : null;
}

/**
 * The two advisory-lock identities a writer of `lookup_tarla` must hold, in
 * the order it must take them.                                  (Slice #34.32)
 *
 * ⚠️ **TWO LOCKS, BECAUSE THE TWO WRITERS FOLD DIFFERENTLY AND AN ADVERSARIAL
 * ROUND SHOWED THAT ONE IS NOT ENOUGH.** Before this slice
 * `resolveTarlaForCreate` took ONE lock, on `cadastralKey` (#34.14), and it
 * serialised the import against itself perfectly well. It does not serialise
 * the import against Reference Data's „Adaugă", because `cadastralKey` and
 * `foldRomanian` cut the same strings into DIFFERENT classes — neither is a
 * refinement of the other:
 *
 *   • `cadastralKey` applies `perToSlash` and removes all whitespace, so it
 *     equates `47per2` with `47/2` and `48 50` with `4850` — pairs this fold
 *     keeps apart.
 *   • `foldRomanian` strips diacritics, so it equates `47PER2` with `47pér2` —
 *     a pair `cadastralKey` keeps apart, because `perToSlash` sees `per` and
 *     not `pér`.
 *
 * So an import holding only the `cadastralKey` lock can be racing an
 * administrator whose code lands in the SAME index bucket, and the loser gets a
 * 23505. On the admin door that is mapped to a sentence; on the import door it
 * would roll the whole property create back under the generic Romanian
 * "operation failed". Holding both locks removes the case: two writers whose
 * rows would collide in migration_083's index always agree on the SECOND
 * identity, whatever the first one says.
 *
 * ⚠️ **THE ORDER IS PART OF THE CONTRACT AND IT IS WHAT RULES OUT A DEADLOCK.**
 * Every writer takes them in the order this function returns them — cadastral
 * key first, fold second — so two transactions can never hold them crosswise.
 * (`ensurePropertyForFolder`'s parcel-identity lock is taken before either, and
 * nothing anywhere takes one of these and then waits for that one.)
 *
 * ⚠️ **AND THAT ARGUMENT IS ABOUT THE IDENTITY STRINGS, NOT ABOUT THE HASHES —
 * WHICH NARROWS A GUARANTEE THIS CODEBASE HAS REPEATED SINCE #34.14.**
 * `advisoryLockKeys` returns a PAIR of independent hashes precisely so that a
 * collision needs both to collide — its own header says that much and no more;
 * the "costs a wait and nothing else" pricing is this codebase's, written at
 * the call sites (`resolveTarlaForCreate`'s header, and the paragraph above).
 * That pricing was exactly right while a transaction held ONE tarla lock. It is no longer the whole story: with two taken in sequence, a
 * transaction A and a transaction B deadlock (Postgres 40P01) if A's FIRST
 * lock key equals B's SECOND *and* B's first equals A's second. A single lock
 * key is a PAIR of independent 32-bit hashes, so one such equality already
 * costs both to collide — roughly 2^-64 for a single pair of keys — and a
 * deadlock needs TWO such equalities, for one specific pair of transactions.
 * It needs no code; it is written down because the sentence it qualifies is
 * quoted in two other files and reads as complete. If it ever mattered, the fix is one lock over a pair-independent
 * identity, not a third hash.
 *
 * ⚠️ **NAMESPACED STRINGS, NOT BARE FOLDS.** `advisoryLockKeys` hashes a
 * string, so a tarla lock and a parcel-identity lock must not be able to BE the
 * same string: a hyphenated code like `48-50d` is character for character the
 * identity of tarla `48`, parcela `50d`. The two prefixes here differ from each
 * other for the same reason.
 *
 * An empty member means "nothing to lock on" — the caller skips it. Both are
 * empty exactly when the code folds to nothing, which is the case the partial
 * index does not cover.
 *
 * ⚠️ **AND THEY MAKE A SAVE WAIT, WHICH IS THE POINT AND IS STILL NEW
 * BEHAVIOUR.** These are transaction-scoped, and the import holds them for the
 * length of `ensurePropertyForFolder`'s transaction — so an administrator
 * pressing „Salvează" on a code an import is minting at that instant now
 * BLOCKS until the import commits, where before it would have returned
 * immediately and made a twin. On a single-user archive that is a fraction of a
 * second; it is named because "the save button hung" is not a symptom anyone
 * would otherwise trace to this function.
 *
 * ⚠️ **WHAT THESE LOCKS STILL DO NOT COVER, NAMED RATHER THAN IMPLIED.**
 * `resolveTarlaForCreate` takes them only when it is about to INSERT — never on
 * the adopt path, deliberately, because locking on every create would serialise
 * every folder of an import that shares one tarla. So an administrator renaming
 * row X from `T3` to `T9` locks `T9`'s identities and not `T3`'s, and an import
 * running concurrently can still read X as `T3` (Read Committed), adopt it, and
 * file a property parsed from a folder saying `T3` under a row that commits as
 * `T9`. Nothing is violated and nothing is logged. It is a rename racing a
 * read, not a twin, and closing it would mean locking the adopt path — the cost
 * #34.14 declined for good reasons. It is in the #34.32 handover.
 */
export function tarlaLockIdentities(code: string): [string, string] {
  const key  = cadastralKey(code);
  const fold = foldRomanian(code);
  return [key === "" ? "" : `tarla:${key}`, fold === "" ? "" : `tarla-fold:${fold}`];
}
