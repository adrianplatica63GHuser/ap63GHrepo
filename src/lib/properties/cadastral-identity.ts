/**
 * What makes two properties the same property.   (Slice #26.07)
 *
 * ONE PLACE, BECAUSE THERE WERE ABOUT TO BE THREE
 * ──────────────────────────────────────────────
 * Three separate pieces of this system answer "is this the same parcel?":
 *
 *   - STR-03 (#26.02) refuses two folders in one chosen folder that mean one
 *     property, via `propertyIdentityOf`;
 *   - the import's property step (#26.07) has to find the Property a folder
 *     already has in the database;
 *   - and whatever writes `tarla_sola` / `parcela` has to write the form the
 *     other two will look for.
 *
 * The third is the one that bites. `/api/documents/[id]/process` has always
 * applied `perToSlash` before the write, so a Property born there holds `47/2`;
 * a create path that wrote the folder's raw `47per2` would produce a second
 * Property that no lookup could ever join back up. The slice brief names this
 * outright: "`perToSlash` must be applied before either is written, or `47per2`
 * and `47/2` become two Properties."
 *
 * So this module owns both halves — the value that goes IN and the key that
 * comes OUT — and `structure-rules.ts` delegates to it rather than keeping a
 * second decode of its own. Two systems answering one question is the drift
 * #26.02's brief deleted S-16 to avoid; this is the same argument applied to a
 * string comparison.
 *
 * THE VALUE AND THE KEY ARE NOT THE SAME STRING, DELIBERATELY
 * ──────────────────────────────────────────────────────────
 * `cadastralValue` is what is stored and shown: `perToSlash` applied, trimmed,
 * and otherwise exactly as the user wrote it — `50D` keeps its capital, because
 * that is what is on the deed.
 *
 * `cadastralKey` is what is COMPARED: folded to lowercase, diacritics stripped,
 * every space removed. It is never stored and never displayed. Folding the
 * stored value instead would mean a property created as `50D` and one created
 * as `50d` are one property whose display value is whichever was written first,
 * which is right — and would ALSO mean the display value silently decides
 * identity, which is the "a display value must never double as a lock" habit
 * in `C:\dev\CLAUDE.md`. Two functions, one of them not user-visible at all.
 */

import { perToSlash } from "@/lib/import/folder-utils";
import { foldRomanian } from "@/lib/import/id-card";

/**
 * The form a cadastral identifier is WRITTEN to the database in.
 *
 *   "47per2"       → "47/2"
 *   "225PER3per24" → "225/3/24"        (perToSlash is case-insensitive)
 *   "  50D  "      → "50D"
 *   "47/2"         → "47/2"            (already decoded — idempotent)
 *
 * Idempotent, which matters because it is applied at two different boundaries:
 * once to a value parsed out of a folder name, and once to a value a user typed
 * into a field that may already hold the decoded form.
 */
export function cadastralValue(raw: string): string {
  return perToSlash(raw).trim();
}

/**
 * The form a cadastral identifier is COMPARED in. Never stored, never shown.
 *
 *   "47per2"  → "47/2"
 *   "47PER2"  → "47/2"
 *   "50D"     → "50d"
 *   " 50 D "  → "50d"
 *   ""        → ""
 *
 * ⚠️ **Whitespace is REMOVED, not collapsed**, and that is one step further
 * than `foldRomanian` goes on its own. A segment that reached here from a
 * folder name can never contain a space — `structure-rules.ts`'s `SEGMENT_RE`
 * refuses one — so on that path the difference is invisible. It exists for the
 * other path: a value typed by hand into the Property form, where `50 D` and
 * `50D` are the same parcel to everyone except a string comparison.
 */
export function cadastralKey(raw: string): string {
  return foldRomanian(perToSlash(raw)).replace(/\s+/g, "");
}

/**
 * The identity of a parcel: its tarla and its parcela, folded, joined.
 *
 * The separator is `-` because that is the separator `propertyIdentityOf` has
 * used since #26.02 and this function replaced its body rather than its
 * meaning.
 *
 * ⚠️ **That separator is only unambiguous for FOLDER-DERIVED halves, so this
 * key is only for folder-derived halves.** A cadastral segment out of
 * `parsePropertyFolderName` is digits, `/` and an allowed letter suffix and
 * nothing else, so a `-` can only be the join — but `property.tarla_sola` is
 * free text a user can type into the Property form, and there
 * `("47", "2-225/3")` and `("47-2", "225/3")` produce one key for two parcels.
 * Which is why matching a folder against the DATABASE does not use this at all:
 * `findPropertiesByCadastralIdentity` compares `cadastralKey` field against
 * field, where there is no separator to be ambiguous in. The two callers left
 * here are `propertyIdentityOf` (folder names, by construction) and
 * `advisoryLockKeys` (a hash, where a collision costs a wait and nothing else).
 *
 * An empty half is preserved rather than rejected — this is a pure key
 * function, and refusing here would put the "may these be blank?" decision in
 * two places. `hasCadastralIdentity` below is where that question is answered.
 */
export function cadastralIdentityKey(tarla: string, parcela: string): string {
  return `${cadastralKey(tarla)}-${cadastralKey(parcela)}`;
}

/**
 * Are these two identifiers enough to identify a property at all?
 *
 * **Both halves, non-empty, or nothing.** A Property carrying a tarla and no
 * parcela cannot be matched against a folder later — every other property with
 * that tarla and no parcela would match it too, and the import would link a
 * folder's documents to a parcel nobody chose. The honest outcome for a half
 * identity is that the property is not matchable, and the import refuses to
 * create one it could never find again.
 *
 * This is why `POST /api/admin/import/property` requires both and the general
 * `POST /api/properties` still does not: the Add-New form serves a user filling
 * in what they know about a parcel in front of them, and that user is allowed
 * to leave a field blank. The import is not, because the import is the thing
 * that has to find it again next month.
 */
export function hasCadastralIdentity(
  tarla: string | null | undefined,
  parcela: string | null | undefined,
): boolean {
  return cadastralKey(tarla ?? "") !== "" && cadastralKey(parcela ?? "") !== "";
}
